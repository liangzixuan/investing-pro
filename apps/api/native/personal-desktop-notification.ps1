param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')]
  [string]$AttemptId,
  [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  if (-not [Environment]::UserInteractive -or [Threading.Thread]::CurrentThread.ApartmentState -ne 'STA') {
    throw 'Unsupported interactive apartment'
  }
  $source = @'
using System;
using System.Drawing;
using System.Diagnostics;
using System.Threading;
using System.Windows.Forms;
public static class PersonalDesktopNotification {
  static volatile bool cancelled;
  static void Emit(string id, string name) {
    Console.WriteLine("{\"attemptId\":\"" + id + "\",\"event\":\"" + name + "\",\"at\":\"" + DateTime.UtcNow.ToString("o") + "\"}");
    Console.Out.Flush();
  }
  public static void Run(string id) {
    NotifyIcon icon = null;
    Icon glyph = null;
    System.Windows.Forms.Timer timer = null;
    ApplicationContext context = null;
    try {
      cancelled = false;
      Thread input = new Thread(delegate() {
        try {
          // A fixed control message or a closed parent pipe both retire this helper.
          string message = Console.ReadLine();
          cancelled = message == null || message == "cancel";
        } catch { cancelled = true; }
      });
      input.IsBackground = true;
      input.Start();
      context = new ApplicationContext();
      icon = new NotifyIcon();
      glyph = (Icon)SystemIcons.Information.Clone();
      icon.Icon = glyph;
      icon.Text = "Investment filing updates";
      icon.BalloonTipShown += delegate { Emit(id, "balloon_shown"); };
      icon.BalloonTipClosed += delegate { Emit(id, "balloon_closed"); };
      icon.BalloonTipClicked += delegate { Emit(id, "balloon_clicked"); };
      icon.Visible = true;
      Emit(id, "ready");
      bool attempted = false;
      Stopwatch clock = Stopwatch.StartNew();
      timer = new System.Windows.Forms.Timer();
      timer.Interval = 100;
      timer.Tick += delegate {
        if (cancelled) {
          timer.Stop();
          Emit(id, "cancelled");
          context.ExitThread();
          return;
        }
        if (!attempted && clock.ElapsedMilliseconds >= 750) {
          attempted = true;
          Emit(id, "submission_attempted");
          try {
            icon.ShowBalloonTip(10000, "Investment filing updates", "New filing updates are available. Open Investment to review your inbox.", ToolTipIcon.Info);
            Emit(id, "submission_call_returned");
          } catch {
            timer.Stop();
            Emit(id, "helper_failed");
            context.ExitThread();
            return;
          }
        }
        if (clock.ElapsedMilliseconds >= 20000) {
          timer.Stop();
          Emit(id, "deadline");
          context.ExitThread();
        }
      };
      timer.Start();
      Application.Run(context);
    } catch { Emit(id, "helper_failed"); }
    finally {
      if (timer != null) { timer.Stop(); timer.Dispose(); }
      if (icon != null) { icon.Visible = false; icon.Dispose(); }
      if (glyph != null) glyph.Dispose();
      if (context != null) context.Dispose();
      Emit(id, "cleanup");
    }
  }
}
'@
  Add-Type -TypeDefinition $source -ReferencedAssemblies System.Windows.Forms,System.Drawing
  if ($ValidateOnly) {
    [Console]::WriteLine('{"validation":"compiled_without_notification"}')
  } else {
    [PersonalDesktopNotification]::Run($AttemptId)
  }
} catch {
  [Console]::WriteLine((@{attemptId=$AttemptId;event='helper_failed';at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress))
  exit 1
}

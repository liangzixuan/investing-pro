package local.investment.personal;

import android.util.Log;
import androidx.test.core.app.ActivityScenario;
import org.json.JSONObject;
import local.investment.personal.ReportRevisitPage.Check;
import local.investment.personal.ReportRevisitPage.Script;
import local.investment.personal.InterimStatementsEvidence.Cell;

/** A captured core period/value is fully visible; a screenshot does not claim the entire source table. */
final class InterimStatementsFrameEvidence {
    enum View {
        INCOME(Cell.REVENUE_QUARTER, PortfolioReportFrameCapture.Frame.INTERIM_INCOME),
        CASH(Cell.OPERATING_CASH, PortfolioReportFrameCapture.Frame.INTERIM_CASH),
        BALANCE(Cell.ASSETS, PortfolioReportFrameCapture.Frame.INTERIM_BALANCE);
        final Cell cell;
        final PortfolioReportFrameCapture.Frame frame;
        View(Cell cell, PortfolioReportFrameCapture.Frame frame) { this.cell=cell; this.frame=frame; }
    }
    record Request(ReportRevisitPage page, ActivityScenario<MainActivity> scenario, View view) {}
    private final Request request;
    InterimStatementsFrameEvidence(Request request) { this.request=request; }
    private static final String MEASURE =
        "function measure(){const row=document.querySelector(selector),v=visualViewport;if(!row||!v)return null;" +
        "const cells=[row.children[1],row.querySelector('[data-interim-value]')];if(cells.some(e=>!e||!e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})))return null;" +
        "const rects=[];for(const cell of cells){const node=cell.firstChild;if(!node||node.nodeType!==Node.TEXT_NODE||!node.textContent.trim())return null;" +
        "const range=document.createRange();range.selectNodeContents(node);const c=cell.getBoundingClientRect();for(const r of range.getClientRects()){rects.push({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,cell:c});}}" +
        "if(rects.length<2)return null;let bottom=v.offsetTop+v.height;const nav=document.querySelector('.managed-navigation');if(nav?.checkVisibility()&&getComputedStyle(nav).position==='fixed')bottom=Math.min(bottom,nav.getBoundingClientRect().top);" +
        "const bounds={left:v.offsetLeft,right:v.offsetLeft+v.width,top:v.offsetTop,bottom};return {rects,bounds,top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom))};}" +
        "function inside(r,b){return r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom;}" +
        "function ready(g){return !!g&&g.rects.every(r=>[r.left,r.right,r.top,r.bottom,r.width,r.height].every(Number.isFinite)&&r.width>0&&r.height>0&&inside(r,g.bounds)&&inside(r,r.cell));}";
    private String scope() { return "const selector="+JSONObject.quote(request.view.cell.selector())+";"+MEASURE; }
    void retain() throws Exception {
        String position="(()=>{"+scope()+"let g=measure();if(!g)return JSON.stringify({ready:false});const target=g.bounds.top+(g.bounds.bottom-g.bounds.top-(g.bottom-g.top))/2;window.scrollBy({top:g.top-target,behavior:'instant'});g=measure();return JSON.stringify({ready:ready(g),scope:'first text of exact period and reported USD cells',geometry:g});})()";
        Log.i("InterimFrameGeometry",request.view.name()+" "+request.page.read(new Script(position)));
        request.page.await(new Check("exact interim core period and reported USD text fit their cells above native navigation: "+request.view.name(),new Script("(()=>{"+scope()+"return ready(measure());})()")).nativeReady());
        new PortfolioReportFrameCapture(new PortfolioReportFrameCapture.Request(request.scenario,request.view.frame)).retain();
    }
}

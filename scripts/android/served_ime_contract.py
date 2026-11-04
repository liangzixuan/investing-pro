"""Pure ownership and recovery rules for the isolated managed-device test IME."""

import re

TARGET = "local.investment.personal"
TEST_PACKAGE = TARGET + ".test"
COMPONENT = TEST_PACKAGE + "/" + TARGET + ".ServedEditorIme"
LEASE_PATH = "cache/served-editor-ime-host-lease.json"
RECOVERY_PATH = "cache/served-editor-ime-recovery.json"
NONCE_ENV = "INVESTMENT_SERVED_IME_HOST_NONCE"
SETTING_KEYS = ("default_input_method", "enabled_input_methods", "selected_input_method_subtype")
PREVIOUS_KEYS = ("previousDefault", "previousEnabled", "previousSubtype")
PROCESS_HEADER = "ACTIVITY MANAGER RUNNING PROCESSES (dumpsys activity processes)"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def enabled_ids(raw):
    return [] if raw is None else [row.split(";", 1)[0] for row in raw.split(":")]


def require_instrumentation_closed(process_dump):
    require(process_dump.startswith(PROCESS_HEADER), "Unrecognized instrumentation observation")
    require("Active instrumentation:" not in process_dump, "Target instrumentation is still active")


def validate_settings(settings):
    require(set(settings) == set(SETTING_KEYS), "Wrong settings shape")
    for value in settings.values():
        require(value is None or (isinstance(value, str) and len(value) <= 16384
                                 and not any(c in value for c in "\x00\r\n")), "Invalid setting")
    selected = settings[SETTING_KEYS[0]]
    require(isinstance(selected, str) and re.fullmatch(r"[\w.]+/[\w.$]+", selected), "Missing selected IME")
    require(selected in enabled_ids(settings[SETTING_KEYS[1]]), "Selected IME not enabled")


def lease_for(identity, nonce, source, settings):
    validate_settings(settings)
    require(re.fullmatch(r"[a-f0-9]{64}", nonce) is not None, "Wrong lease nonce")
    require(re.fullmatch(r"[a-f0-9]{40}", source) is not None, "Wrong source")
    require(re.fullmatch(r"emulator-[0-9]+", identity["serial"]) is not None, "Not emulator serial")
    require(identity["qemu"] == "1" and identity["api"] == "36", "Not API 36 emulator")
    require(type(identity["user"]) is int and identity["user"] >= 0, "Invalid user")
    require(re.fullmatch(r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}", identity["bootId"]) is not None,
            "Invalid boot identity")
    require(COMPONENT not in enabled_ids(settings[SETTING_KEYS[1]]), "Fixture IME already enabled without this lease")
    return {"schema": 1, "nonce": nonce, "serial": identity["serial"], "user": identity["user"],
            "bootId": identity["bootId"], "sourceSha": source,
            **dict(zip(PREVIOUS_KEYS, (settings[k] for k in SETTING_KEYS)))}


def baseline(lease):
    return dict(zip(SETTING_KEYS, (lease[k] for k in PREVIOUS_KEYS)))


def validate_recovery(record, lease):
    keys = {"schema", "nonce", "serial", "user", "bootId", "component", *PREVIOUS_KEYS,
            "initiallyEnabled", "phase"}
    require(isinstance(record, dict) and set(record) == keys, "Wrong recovery shape")
    for key in ("schema", "nonce", "serial", "user", "bootId", *PREVIOUS_KEYS):
        require(type(record[key]) is type(lease[key]) and record[key] == lease[key], "Recovery identity differs: " + key)
    require(record["component"] == COMPONENT, "Wrong recovery component")
    require(record["initiallyEnabled"] is False, "Foreign initial fixture state")
    require(record["phase"] in ("prepared", "active", "restoring", "restored"), "Wrong recovery phase")


def recovery_commands(record, lease, current):
    """Return only the exact lease's restoration; never reset a keyboard collection."""
    validate_recovery(record, lease)
    validate_settings(current)
    previous = baseline(lease)
    require(current[SETTING_KEYS[0]] in (COMPONENT, previous[SETTING_KEYS[0]]), "Intervening foreign IME selection")
    before_rows = [] if previous[SETTING_KEYS[1]] is None else previous[SETTING_KEYS[1]].split(":")
    now_rows = [] if current[SETTING_KEYS[1]] is None else current[SETTING_KEYS[1]].split(":")
    require([r for r in now_rows if r.split(";", 1)[0] != COMPONENT] == before_rows,
            "Intervening enabled IME change")
    require(sum(r.split(";", 1)[0] == COMPONENT for r in now_rows) <= 1, "Duplicate fixture entry")
    if record["phase"] == "restored":
        require(current == previous, "Restored receipt differs from current settings")
        return []
    if current == previous:
        return []
    user = str(lease["user"])
    commands = []
    if current[SETTING_KEYS[0]] == COMPONENT:
        commands.append(["ime", "set", "--user", user, previous[SETTING_KEYS[0]]])
    subtype = previous[SETTING_KEYS[2]]
    commands.append(["settings", "--user", user, "delete" if subtype is None else "put", "secure",
                     SETTING_KEYS[2], *([] if subtype is None else [subtype])])
    if COMPONENT in enabled_ids(current[SETTING_KEYS[1]]):
        commands.append(["ime", "disable", "--user", user, COMPONENT])
    return commands


def gradle_command(source, shard, nonce):
    require(re.fullmatch(r"[a-f0-9]{40}", source) is not None and shard in ("0", "1"), "Wrong run identity")
    require(re.fullmatch(r"[a-f0-9]{64}", nonce) is not None, "Wrong nonce")
    return ["bash", "./gradlew", "--no-daemon", "--console=plain",
            "-PinvestmentClientProfile=disconnected",
            "-Pandroid.testInstrumentationRunnerArguments.numShards=2",
            "-Pandroid.testInstrumentationRunnerArguments.shardIndex=" + shard,
            "-Pandroid.testoptions.manageddevices.emulator.gpu=swiftshader_indirect",
            "-Pandroid.testInstrumentationRunnerArguments.expectedSourceSha=" + source,
            "-Pandroid.testInstrumentationRunnerArguments.servedEditorImeLease=" + nonce,
            ":app:pixel2Api36DebugAndroidTest"]

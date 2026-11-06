extends RefCounted
## Perf: startup timing. mark("label") prints the time since the previous mark and since the
## first one, so the browser console (and the headless log) shows where the load goes.

static var _t0: int = 0
static var _last: int = 0
static var enabled: bool = false


## On with the user arg --perf, or ?museumperf in the page URL.
static func setup() -> void:
	enabled = OS.get_cmdline_user_args().has("--perf") or (OS.has_feature("web") and bool(JavaScriptBridge.eval("location.search.indexOf('museumperf') >= 0", true)))


static func mark(label: String) -> void:
	if not enabled:
		return
	var now := Time.get_ticks_usec()
	if _t0 == 0:
		_t0 = now
		_last = now
	print("[perf] %-28s +%7.1f ms  (total %7.1f ms)" % [label, float(now - _last) / 1000.0, float(now - _t0) / 1000.0])
	_last = now

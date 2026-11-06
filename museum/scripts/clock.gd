extends RefCounted
## Clock: the song clock. Everything the lights do is a pure function of this. Owns: song time
## (page bridge `time()` or the internal fallback), beat/bar, the section and energy lookup from
## the song's cue sheet (res://songs/<id>.json, or the page's), the build ramp, kick/downbeat envelopes, and the tab-visibility fps throttle.
##
## Usage: var clock := Clock.new(); clock.setup(cues); each frame clock.advance(dt).

const FPS_CAP := 60
## The build (the screen's 4-3-2-1 countdown, the rising strobes) runs over this many bars at the end
## of every break that is followed by a drop; the blackout is the last beat of it.
const BUILD_BARS := 4.0

var bridge = null           # JavaScriptBridge interface "museumBridge", or null
var frozen: bool = false    # hold t still (capture shots)
var bpm: float = 128.0
var nbars: int = 64
var loop_seconds: float = 120.0   # one pass through the cue sheet, seconds (nbars * 4 beats at bpm)
var secs: Array = []

var t: float = 0.0          # song seconds
var dt: float = 0.0         # last frame delta
var beat: float = 0.0
var bar: float = 0.0
var dbar: float = 0.0       # bar counted from the start of the current drop (== bar outside a drop); phrase logic uses this
var e: float = 0.3          # section energy 0..1 (eased across section edges, ramps in a break)
var sec_name: String = "intro"
var kick: bool = true
var build: float = 0.0      # 0..1 ramp over the last 4 bars of a break
var kp: float = 0.0         # kick pulse, decays each beat
var down: float = 0.0       # downbeat pulse, decays each bar
var black: float = 1.0      # 0.15 for the blackout just before a drop
var is_drop: bool = false
var visible: bool = true

var _vis_poll: float = 0.0


func setup(cues: Dictionary) -> void:
	bpm = float(cues.get("bpm", 128.0))
	nbars = int(cues.get("bars", 64))
	secs = cues.get("sections", [])
	loop_seconds = float(cues.get("loopSeconds", float(nbars) * 240.0 / bpm))
	t = fposmod(t, loop_seconds)


## Pin the song time (capture shots) and stop it advancing.
func set_fixed(seconds: float) -> void:
	t = seconds
	frozen = true


## Step the clock by dt and refresh the derived state. Returns song time.
func advance(delta: float) -> float:
	dt = delta
	if bridge != null:
		var v = bridge.time()
		if typeof(v) == TYPE_FLOAT or typeof(v) == TYPE_INT:
			t = fposmod(float(v), loop_seconds)
			_refresh()
			return t
	if not frozen:
		t = fposmod(t + delta, loop_seconds)
	_refresh()
	return t


## Visibility throttle: when the page tab is hidden, drop the frame rate cap. Call every frame.
func poll_visible(delta: float) -> void:
	_vis_poll -= delta
	if _vis_poll > 0.0:
		return
	_vis_poll = 0.4
	var v := true
	if bridge != null:
		var r = bridge.visible()
		if typeof(r) == TYPE_BOOL:
			v = r
	if v != visible:
		visible = v
		Engine.max_fps = FPS_CAP if v else 4


func _refresh() -> void:
	beat = t * bpm / 60.0
	bar = beat / 4.0
	var bw := fposmod(bar, float(nbars))
	var idx := -1
	for i in secs.size():
		var s: Dictionary = secs[i]
		if bw >= float(s["from"]) and bw < float(s["to"]):
			idx = i
			break
	var sec: Dictionary
	var nxt: Dictionary
	if idx < 0:
		sec = {"name": "intro", "from": 0, "to": nbars, "energy": 0.4, "kick": true}
		nxt = sec
	else:
		sec = secs[idx]
		nxt = secs[(idx + 1) % secs.size()]
	sec_name = str(sec["name"])
	kick = bool(sec["kick"])
	e = float(sec["energy"])
	is_drop = sec_name == "drop"
	dbar = bar
	if is_drop:
		# a drop may be cut into several cue sections; the phrases count from where the run began
		var first := idx
		while first > 0 and str(secs[first - 1]["name"]) == "drop":
			first -= 1
		dbar = bar - float(secs[first]["from"])
	var to := float(sec["to"])
	build = 0.0
	black = 1.0
	if sec_name == "break":
		# the break may also be cut into sections: its end is where the run of breaks ends
		var last := idx
		while last + 1 < secs.size() and str(secs[last + 1]["name"]) == "break":
			last += 1
		to = float(secs[last]["to"])
		var after: Dictionary = secs[(last + 1) % secs.size()]
		if str(after["name"]) == "drop":
			build = clampf((bw - (to - BUILD_BARS)) / BUILD_BARS, 0.0, 1.0)
			e = 0.25 + 0.4 * pow(build, 1.5)
			if bw > to - 0.25:
				black = 0.15
	elif str(nxt["name"]) != "drop":
		e = lerpf(e, float(nxt["energy"]), smoothstep(to - 0.5, to, bw))
	kp = exp(-fposmod(beat, 1.0) * 4.5) if kick else 0.0
	down = exp(-fposmod(bar, 1.0) * 4.0) if kick else 0.0

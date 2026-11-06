extends Node3D
## Camera, stage hold, free walk, page bridge, capture shots. The hall (hall.gd) composes the world and
## the light show; layout.gd holds poses, blockers and shot definitions; clock.gd the song clock;
## player.gd the walker (movement, collision, focus); touch_controls.gd the phone controls.
##
## Flow: the game opens on the stage hold (Layout.stage_pose) and stays there, with only a faint idle
## drift, tour state "stage", until the page sends `browse` (the Browse projects button). There is no
## opening move. `browse` pulls back out from the stage on a crane arc and glides to exhibit 1; each
## exhibit is held HOLD_BARS (8) bars (moves start on bar lines, clock.gd), through the last, then the
## camera glides to the entrance and looks up at the marquee (Layout.end_pose), "end", and holds.
## Tour position _t: 0 the stage, 1..n the exhibits, n+1 the end.
## `next`/`prev` jump at once (the tour keeps running from there), `tour:pause` / `tour:play`,
## `goto:<id>` flies there and pauses (`goto:stage` the stage hold, `goto:entrance` the end view, like
## `home`: focus "" and tour "paused" while flying, then "end"), and any walk input pauses ("paused").
## Glides are 2..3.4 s eased and turn the way the camera travels; reduced motion shortens them and
## stops the drift. Moves are TRANS mode; holds and free walk are PLAY mode (the player stands at the
## held pose).
##
## Modes: TRANS (an eased timed move: a tour glide) and PLAY (holds and free walk).
## Desktop: WASD strafe/walk, Up/Down walk, Left/Right turn, Shift fast, click an exhibit's wall to
## fly there. Phones: the touch stick and look finger (touch_controls.gd), tap an exhibit to fly there.
##
## Look (the usual game convention: mouse right turns right, mouse up looks up; yaw grows to the LEFT,
## so a right turn lowers it). On desktop the mouse looks with no button held, using relative motion
## (MOUSE_DEG_PER_PX, lightly smoothed) and no pointer lock: the cursor stays visible and free to
## reach the page's buttons. Holding a button and dragging turns the same way and speed. A press that
## stays within MOUSE_SLOP is a click (it flies to the exhibit) and is not counted as a look.
## Where the look goes depends on the camera: during the tour (glides, holds) and at the stage hold it
## is a bounded *glance* (+-GLANCE_YAW/+-GLANCE_PITCH degrees) added on top of the aimed shot, and it
## never pauses the tour; each new glide eases the glance back to zero over GLANCE_RETURN seconds. In
## free walk, paused and at the end the mouse turns the player fully (unbounded yaw, +-60ish pitch).
## Only WASD/arrows (and touch looks) pause the tour. Edge turning: while the cursor rests in the
## outer EDGE_FRAC of the canvas it keeps yawing that way (eased in, EDGE_MAX_DEG_S at most), so a
## visitor can turn all the way round without lifting the mouse; it stops when the cursor leaves the
## canvas or the window loses focus, and is off for reduced motion. Phones: touch_controls.gd turns
## the same way (drag right turns right, drag up looks up).
##
## Panel framing: the page's details panel covers the right of the screen on desktop (bridge
## rightInset(), CSS px, 0 when closed or absent); while an exhibit is held the view turns slightly
## right, eased, so the art sits in the uncovered part. On phones the bottom sheet (bottomInset())
## pitches the exhibit poses up instead.
##
## Bridge (window.museumBridge, see museumBridge.ts): time(), visible(), pollCommand() (next / prev
## / home / browse / tour:pause / tour:play / goto:<id>), reducedMotion(), bottomInset() and rightInset() (CSS px)
## in; onReady(), onFocus(id) ("" none, "stage"), onTour(state: stage, touring, paused, end),
## onIntroDone() (sent with onReady, kept for the page), onWalk(bool), onBuildProgress(f), and the
## debugPos string property out.

const Hall := preload("res://scripts/hall.gd")
const Layout := preload("res://scripts/layout.gd")
const Clock := preload("res://scripts/clock.gd")
const Player := preload("res://scripts/player.gd")
const TouchControls := preload("res://scripts/touch_controls.gd")
const Perf := preload("res://scripts/perf.gd")
const Warm := preload("res://scripts/warm.gd")
const FPS_CAP := 60

## debugPos reports the mode as 1 (TRANS, an auto-walk) or 2 (PLAY, holds and free walk).
enum Mode { TRANS = 1, PLAY = 2 }

## Mobile web render budget: at most this many physical pixels, and never above 2x device pixels.
const MAX_PIXELS := 1_400_000.0
const MAX_DPR := 2.0
## Of the page's build progress (0..1) the hall construction takes this share, shader warm-up the rest.
const BUILD_SHARE := 0.35
const PULL_SECONDS := 4.2        # the pull-out from the stage hold to exhibit 1
const HOLD_BARS := 8.0           # an exhibit is held about this many bars (~15 s, time to read the details), then the move starts on a bar line
const PANEL_EASE := 6.0          # rate (1/s) the framing shift for the page's right panel eases at (~0.5 s)
const MOUSE_DEG_PER_PX := 0.15
const MOUSE_SLOP := 5.0
const MOUSE_SMOOTH := 30.0       # look smoothing rate (1/s); higher is snappier
const GLANCE_YAW := 30.0         # bounded look while the camera is on a tour shot
const GLANCE_PITCH := 20.0
const GLANCE_RETURN := 0.8       # seconds for the glance to ease back to zero on each new glide
const EDGE_FRAC := 0.06
const EDGE_MAX_DEG_S := 45.0
const EDGE_ACCEL := 150.0        # degrees per second squared (ease-in)
const FOCUS_SETTLE := 0.25
const DEFAULT_SONG := "after-hours"   # the bundled cue sheet (res://songs/) used without the page or --song
const SHEET_EASE := 6.0               # rate (1/s) the pitch for the phone bottom sheet eases at

var hall: Node3D
var cam: Camera3D
var exhibits: Array = []
var cues: Dictionary = {}
var _cues_from_page: bool = false   # the cue sheet came from the page (this visit's song), not the bundled default
var _song_arg: String = ""          # --song=<id>: render a bundled song (desktop runs, --shot)
var bridge = null
var clock := Clock.new()
var player := Player.new()
var controls: CanvasLayer

var mode: int = Mode.PLAY
var _bridge_try: float = 0.0
var _frames: int = 0
var _ready_sent: bool = false
var _built: bool = false
var _warm_done: bool = false
var _mobile: bool = false
var _force_mobile: bool = false
var _dpr: float = 1.0
var _state: Dictionary = {}       # the camera right now: pos, yaw, pitch, fov
var _fov: float = 60.0
var _fov_goal: float = 60.0
var _inset_css: float = 0.0
var _right_inset_css: float = 0.0  # CSS px the page's desktop details panel covers on the right (0 when closed, on phones, or absent)
var _sheet_pitch: float = 0.0      # eased pitch offset (degrees, negative looks up) that keeps the art above the phone bottom sheet
var _panel_yaw: float = 0.0        # eased yaw offset (degrees, negative turns right) that centres the art in the uncovered part

var _stage_aspect: float = -1.0   # aspect the stage hold was last fitted for

var _tour: String = "stage"       # what the page is told: stage, touring, paused, end
var _t: int = 0                   # tour position: 0 the stage, 1..n the exhibits, n+1 the end at the marquee
var _playing: bool = false        # the tour advances by itself
var _depart_bar: float = -1.0     # song bar (unwrapped) of the next departure, or -1
var _bar_abs: float = 0.0
var _bar_last: float = -1.0
var _reduced: bool = false
var _drift_w: float = 0.0         # 0..1 how much the held shot drifts
var _drift_clock: float = 0.0
var _drift := {"pos": Vector3.ZERO, "yaw": 0.0, "pitch": 0.0}

var _tr_from: Dictionary = {}
var _tr_to: Dictionary = {}
var _tr_t: float = 0.0
var _tr_dur: float = 1.0
var _tr_lift := Vector3.ZERO
var _tr_turn: float = 0.0
var _tr_slow_turn: bool = false

var _focus_code: int = -99       # last emitted: Player.FOCUS_*, or a bay index
var _focus_cand: int = -99
var _focus_cand_t: float = 0.0
var _focus_bay: int = -1
var _walk_idle: float = 1.0

var _mouse_down: bool = false
var _mouse_moved: bool = false
var _mouse_press := Vector2.ZERO
var _mouse_ms: int = 0
var _look_pending := Vector2.ZERO  # mouse look not yet applied, degrees (x yaw, y pitch; yaw grows to the left)
var _glance := Vector2.ZERO        # bounded look added on top of a tour shot, degrees (x yaw, y pitch)
var _glance_return: float = 0.0    # seconds left of the ease back to zero after a new glide began
var _cursor_in: bool = false       # the cursor is over the canvas (a motion event seen, no exit since)
var _cursor_x: float = 0.0         # last cursor x in viewport units
var _edge_vel: float = 0.0         # edge-turn yaw rate, degrees per second (positive turns left)
var _inset_poll: float = 0.0
var _dbg_poll: float = 0.0

var _shot: bool = false
var _shot_stop: int = -1
var _shot_pull: float = -1.0
var _shot_end: bool = false
var _shot_cam: Dictionary = {}    # from --shot: {"cam": Transform3D, "fov": float}
var _dbg_cam: Array = []


func _ready() -> void:
	Perf.setup()
	Perf.mark("main._ready (engine ticks: %d ms)" % Time.get_ticks_msec())
	exhibits = _load_json("res://exhibits.json", [])
	for a in OS.get_cmdline_user_args():
		if a == "--tier=mobile":
			_force_mobile = true
		elif a.begins_with("--song="):
			_song_arg = a.substr(7)
	_load_cues()
	# iPadOS Safari reports as a Mac, so ask the page whether the primary pointer is coarse too.
	_mobile = _force_mobile or OS.has_feature("web_android") or OS.has_feature("web_ios") or _web_coarse_pointer()
	if _mobile:
		# 8x anisotropic from project.godot is for desktop; phones get 4x (cheaper fill, same look)
		get_viewport().anisotropic_filtering_level = Viewport.ANISOTROPY_4X
		get_window().size_changed.connect(_fit_render_scale)
		_fit_render_scale()
	Engine.max_fps = FPS_CAP
	hall = Hall.new()
	# hidden while it is built (the frames in between would draw, and so compile, half a hall)
	hall.visible = false
	add_child(hall)
	cam = Camera3D.new()
	cam.far = 260.0
	cam.near = 0.1
	add_child(cam)
	cam.make_current()
	player.setup(exhibits.size())
	controls = TouchControls.new()
	controls.tapped.connect(_tap)
	add_child(controls)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="):
			_apply_shot(a.substr(7))
		elif a.begins_with("--stop="):
			_shot = true
			_shot_stop = clampi(int(a.substr(7)), 0, exhibits.size() + 1)
		elif a.begins_with("--t="):
			clock.t = float(a.substr(4))
		elif a.begins_with("--cam="):
			_dbg_cam = Array(a.substr(6).split(",")).map(func(x): return float(x))
		elif a == "--noscale":
			get_window().content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
		elif a == "--freeze":
			clock.frozen = true
	mode = Mode.PLAY
	if _shot:
		_focus_bay = Layout.bay_of_stop(maxi(_shot_stop, 0), exhibits.size())
	else:
		_hold_stage()
	_fov = float(_state.get("fov", 60.0))
	_fov_goal = _fov
	_update_camera()
	_try_bridge()
	Perf.mark("main._ready end")
	_load_world()


## Build the hall a module at a time, then compile its shaders (warm.gd), telling the page how
## far along it is. Neither is on screen: the page shows its poster until onReady. The page's bar
## shows this as the last part of loading: building is the first BUILD_SHARE of it, shaders the rest.
func _load_world() -> void:
	await hall.build(exhibits, _mobile, _after_build_step)
	# nothing draws until Warm has compiled the shaders
	Warm.hide(hall)
	hall.visible = true
	_built = true
	if DisplayServer.get_name() == "headless":
		# no renderer, so no frames to wait for
		Warm.run_headless()
	else:
		await Warm.run(hall, _on_warm_progress)
	_warm_done = true
	Perf.mark("warm done")


func _after_build_step(fraction: float) -> void:
	_report(fraction * BUILD_SHARE)
	# a frame, so the page can repaint and the browser stays responsive between modules
	await get_tree().process_frame


func _on_warm_progress(fraction: float) -> void:
	Perf.mark("warm %3.0f%%" % (fraction * 100.0))
	_report(BUILD_SHARE + fraction * (1.0 - BUILD_SHARE))


func _report(fraction: float) -> void:
	_try_bridge()
	if bridge != null:
		bridge.onBuildProgress(fraction)


func _web_coarse_pointer() -> bool:
	if not OS.has_feature("web"):
		return false
	return bool(JavaScriptBridge.eval("window.matchMedia('(pointer: coarse)').matches", true))


## Render at min(DPR, 2) of CSS size, scaled down further to MAX_PIXELS, and let the canvas stretch
## back to its full CSS size. Re-run on every resize so an orientation change refits the camera
## (the aspect is read each frame) and keeps the pixel budget.
func _fit_render_scale() -> void:
	var w := get_window()
	if OS.has_feature("web"):
		_dpr = maxf(1.0, float(JavaScriptBridge.eval("window.devicePixelRatio || 1", true)))
	var phys := Vector2(DisplayServer.window_get_size())
	if phys.x < 2.0 or phys.y < 2.0:
		return
	var k := minf(1.0, MAX_DPR / _dpr)
	k = minf(k, sqrt(MAX_PIXELS / (phys.x * phys.y)))
	w.content_scale_mode = Window.CONTENT_SCALE_MODE_VIEWPORT
	w.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	w.content_scale_size = Vector2i(maxi(2, roundi(phys.x * k)), maxi(2, roundi(phys.y * k)))


## CSS pixels per viewport unit: converts touch deltas (viewport units) into thumb-sized distances.
func _css_per_unit() -> float:
	var vs := get_viewport().get_visible_rect().size
	if not _mobile:
		return 1.0
	var phys := Vector2(DisplayServer.window_get_size())
	return (phys.x / _dpr) / maxf(vs.x, 1.0)


func _load_json(path: String, fallback) -> Variant:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("missing " + path)
		return fallback
	var v = JSON.parse_string(f.get_as_text())
	return v if v != null else fallback


func _try_bridge() -> void:
	if bridge == null and OS.has_feature("web"):
		bridge = JavaScriptBridge.get_interface("museumBridge")
		clock.bridge = bridge
	_try_page_cues()


## The cue sheet: the bundled song named by --song=<id> (DEFAULT_SONG without it) now, then, in the
## browser, this visit's song from the page once the bridge is there (_try_page_cues, retried with
## the bridge). The page's wins unless --song was given.
func _load_cues() -> void:
	var id := _song_arg if _song_arg != "" else DEFAULT_SONG
	cues = _load_json("res://songs/%s.json" % id, {})
	if cues.is_empty() and id != DEFAULT_SONG:
		cues = _load_json("res://songs/%s.json" % DEFAULT_SONG, {})
	clock.setup(cues)
	_try_page_cues()


func _try_page_cues() -> void:
	if _cues_from_page or _song_arg != "" or bridge == null:
		return
	var f = bridge.songCues      # missing on a page older than this build
	if f == null:
		return
	var parsed = JSON.parse_string(str(bridge.songCues()))
	if typeof(parsed) == TYPE_DICTIONARY and parsed.has("sections"):
		cues = parsed
		_cues_from_page = true
		clock.setup(cues)


## Capture shot (--shot=<name>, see Layout.shot): pin song time, freeze, and show a stop's pose, the end
## view or a custom camera. Same everywhere, so frames are comparable.
func _apply_shot(shot_name: String) -> void:
	var sh := Layout.shot(shot_name, exhibits.size())
	if sh.is_empty():
		push_error("unknown shot '%s' (try: %s)" % [shot_name, ", ".join(Layout.SHOT_NAMES)])
		return
	_shot = true
	_shot_stop = int(sh["stop"])
	if sh.has("pull"):
		_shot_pull = float(sh["pull"])
	_shot_end = bool(sh.get("end", false))
	clock.set_fixed(float(sh["t"]))
	if sh.has("cam"):
		_shot_cam = {"cam": sh["cam"], "fov": sh["fov"]}


func _process(delta: float) -> void:
	if not _built:
		return
	_frames += 1
	if _frames <= 6:
		Perf.mark("frame %d (delta %.0f ms)" % [_frames, delta * 1000.0])
	if bridge == null:
		_bridge_try -= delta
		if _bridge_try <= 0.0:
			_bridge_try = 0.5
			_try_bridge()
	clock.poll_visible(delta)
	if bridge != null:
		for _i in 8:
			var c := str(bridge.pollCommand())
			if c == "":
				break
			_command(c)
	if not clock.visible:
		return
	if not _shot:
		_tick_look(delta)
		_tick_panel(delta)
		_tick_sheet(delta)
		match mode:
			Mode.TRANS:
				_tick_trans(delta)
			Mode.PLAY:
				_tick_play(delta)
		_poll_page(delta)
		_tick_tour()
	controls.enabled = _mobile and not _shot
	controls.css = _css_per_unit()
	controls.inset_css = _inset_css
	_update_camera()
	clock.advance(delta)
	_track_bars()
	hall.update(clock, {"bay": _focus_bay, "cam_basis": cam.global_transform.basis, "cam_pos": cam.global_position})
	if not _ready_sent and _warm_done and _frames >= 2:
		_ready_sent = true
		Perf.mark("onReady")
		if bridge != null:
			bridge.onReady()
			if not _shot:
				_emit_focus(Player.FOCUS_STAGE, true)
				bridge.onTour(_tour)
				bridge.onIntroDone()


func _poll_page(delta: float) -> void:
	if bridge == null:
		return
	_inset_poll -= delta
	if _inset_poll <= 0.0:
		_inset_poll = 0.1
		var v = bridge.bottomInset()
		if typeof(v) == TYPE_FLOAT or typeof(v) == TYPE_INT:
			_inset_css = maxf(0.0, float(v))
		# rightInset() is newer than the page of an older bridge: treat a missing one as 0
		var ri = bridge.rightInset
		if ri != null:
			var rv = bridge.rightInset()
			_right_inset_css = maxf(0.0, float(rv)) if (typeof(rv) == TYPE_FLOAT or typeof(rv) == TYPE_INT) else 0.0
		else:
			_right_inset_css = 0.0
	_dbg_poll -= delta
	if _dbg_poll <= 0.0:
		_dbg_poll = 0.2
		var rm = bridge.reducedMotion()
		_reduced = typeof(rm) == TYPE_BOOL and rm
		var p: Vector3 = _state["pos"]
		bridge.debugPos = "%.2f,%.2f,%.2f,%.1f,%d" % [p.x, p.y, p.z, float(_state["yaw"]), mode]
		bridge.debugGlance = "%.1f,%.1f" % [_glance.x, _glance.y]


# ---------------------------------------------------------------- camera

func _aspect() -> float:
	var vs := get_viewport().get_visible_rect().size
	return vs.x / maxf(vs.y, 1.0)


func _update_camera() -> void:
	var st := _state
	var fov := _fov
	if _shot:
		var a := _aspect()
		var ps: Dictionary
		if _shot_pull >= 0.0:
			_setup_move(Layout.stage_pose(a), _tour_pose(1), true)
			ps = _mix_move(_ease(_shot_pull))
		elif _shot_end:
			ps = Layout.end_pose(a)
		else:
			ps = Layout.pose(maxi(_shot_stop, 0), a, exhibits.size())
		st = ps
		fov = float(ps["fov"])
	var pos: Vector3 = st["pos"]
	var yaw: float = st["yaw"]
	var pitch: float = st["pitch"]
	if _dbg_cam.size() == 6:
		pos = Vector3(_dbg_cam[0], _dbg_cam[1], _dbg_cam[2])
		yaw = _dbg_cam[3]
		pitch = _dbg_cam[4]
		fov = _dbg_cam[5]
	if not _shot and mode == Mode.PLAY:
		pos += _drift["pos"] as Vector3
		yaw += float(_drift["yaw"])
		pitch += float(_drift["pitch"])
	if not _shot:
		yaw += _glance.x + _panel_yaw
		pitch += _glance.y + _sheet_pitch
	cam.fov = fov
	cam.global_transform = Transform3D(Basis.from_euler(Vector3(deg_to_rad(pitch), deg_to_rad(yaw), 0.0)), pos)
	if not _shot_cam.is_empty() and _dbg_cam.size() != 6:
		cam.global_transform = _shot_cam["cam"]
		cam.fov = _shot_cam["fov"]


static func _ease(u: float) -> float:
	var x := clampf(u, 0.0, 1.0)
	return x * x * x * (x * (x * 6.0 - 15.0) + 10.0)


# ---------------------------------------------------------------- tour and transitions

## Stand on the stage hold, fitted to the current aspect (also after a resize while it is held).
func _hold_stage() -> void:
	var sp := Layout.stage_pose(_aspect())
	_stage_aspect = _aspect()
	player.set_state(sp)
	_fov_goal = float(sp["fov"])
	_fov = _fov_goal
	_state = _player_state()
	_t = 0


## Set up a move: a quadratic curve through the midpoint plus half of the lift, and a yaw sweep
## that turns the way the camera is travelling (so swinging from one wall to the other looks
## ahead down the hall instead of whipping round).
func _setup_move(from: Dictionary, to: Dictionary, from_stage: bool) -> void:
	_tr_from = from.duplicate()
	_tr_to = to
	_tr_lift = Layout.glide_lift(from_stage)
	_tr_slow_turn = from_stage
	var raw := fposmod(float(to["yaw"]) - float(from["yaw"]), 360.0)
	var d := wrapf(float(to["yaw"]) - float(from["yaw"]), -180.0, 180.0)
	if absf(d) > 150.0:
		var y0 := wrapf(float(from["yaw"]), -180.0, 180.0)
		var toward_entrance: bool = (to["pos"] as Vector3).z > (from["pos"] as Vector3).z
		var s := 1.0 if (y0 > 0.0) == toward_entrance else -1.0
		d = raw if s > 0.0 else raw - 360.0
	_tr_turn = d


func _begin_trans(from: Dictionary, to: Dictionary, dur: float, from_stage: bool = false) -> void:
	var f := from.duplicate()
	f["fov"] = _fov
	_setup_move(f, to, from_stage)
	_tr_t = 0.0
	_tr_dur = maxf(dur, 0.05)
	mode = Mode.TRANS
	_glance_return = GLANCE_RETURN


## The camera along the current move at eased progress e.
func _mix_move(e: float) -> Dictionary:
	var p0: Vector3 = _tr_from["pos"]
	var p1: Vector3 = _tr_to["pos"]
	var c := (p0 + p1) * 0.5 + _tr_lift
	var om := 1.0 - e
	var er := e * e * (3.0 - 2.0 * e) if _tr_slow_turn else e
	return {
		"pos": p0 * (om * om) + c * (2.0 * om * e) + p1 * (e * e),
		"yaw": float(_tr_from["yaw"]) + _tr_turn * er,
		"pitch": lerpf(float(_tr_from["pitch"]), float(_tr_to["pitch"]), er),
		"fov": lerpf(float(_tr_from["fov"]), float(_tr_to["fov"]), er),
	}


func _tick_trans(delta: float) -> void:
	_tr_t += delta
	var u := _tr_t / _tr_dur
	_state = _mix_move(_ease(u))
	_fov = float(_state["fov"])
	if (_move_input().length() > 0.01 or _turn_input() != 0.0):
		# the visitor took over: keep walking from here
		player.set_state(_state)
		_fov_goal = _fov
		mode = Mode.PLAY
		_pause_tour()
		return
	if u < 1.0:
		return
	player.set_state(_tr_to)
	_fov_goal = float(_tr_to["fov"])
	_fov = _fov_goal
	_state = _player_state()
	mode = Mode.PLAY
	_focus_cand = -99
	_drift_w = 0.0
	_arrive()


func _player_state() -> Dictionary:
	var st := player.state()
	st["fov"] = _fov
	return st


## The camera as the viewer sees it right now (the hold drift included), so a move starts from
## exactly what is on screen.
func _shown_state() -> Dictionary:
	var st := _state.duplicate()
	if mode == Mode.PLAY:
		st["pos"] = (st["pos"] as Vector3) + (_drift["pos"] as Vector3)
		st["yaw"] = float(st["yaw"]) + float(_drift["yaw"])
		st["pitch"] = float(st["pitch"]) + float(_drift["pitch"])
	return st


## Camera pose for tour position t: 0 the stage hold, 1..n the exhibits, n+1 the marquee at the entrance.
func _tour_pose(t: int) -> Dictionary:
	var n := exhibits.size()
	var a := _aspect()
	if t <= 0:
		return Layout.stage_pose(a)
	if t > n:
		return Layout.end_pose(a)
	var to := Layout.walk_pose(t, a, n)
	return to


## Fly to tour position t (0 stage, 1..n exhibits, n+1 the end at the marquee). play: keep the tour
## running from there; otherwise pause there.
func _go(t: int, play: bool) -> void:
	var n := exhibits.size()
	var from_stage := _t == 0 and t == 1
	_t = clampi(t, 0, n + 1)
	var to := _tour_pose(_t)
	var from := _shown_state()
	var dist := (from["pos"] as Vector3).distance_to(to["pos"] as Vector3)
	var dur := PULL_SECONDS if from_stage else clampf(1.5 + dist / 6.5, 2.0, 3.4)
	if _reduced:
		dur = minf(dur * 0.4, 1.2)
	_begin_trans(from, to, dur, from_stage)
	_playing = play
	_depart_bar = -1.0
	_set_tour("touring" if play else "paused")
	var code := Player.FOCUS_STAGE if _t == 0 else (Player.FOCUS_NONE if _t > n else _t - 1)
	_emit_focus(code, true)
	if bridge != null:
		bridge.onWalk(false)


## A move is done: hold. A playing tour sets its next departure to a bar line about HOLD_BARS on;
## the stage and the end just hold.
func _arrive() -> void:
	var n := exhibits.size()
	if _t == 0:
		_playing = false
		_set_tour("stage")
	elif _t > n:
		_playing = false
		_set_tour("end")
	elif _playing:
		_depart_bar = ceilf(_bar_abs + HOLD_BARS)


func _pause_tour() -> void:
	_playing = false
	_depart_bar = -1.0
	_set_tour("paused")


func _set_tour(s: String) -> void:
	if s == _tour:
		return
	_tour = s
	if bridge != null:
		bridge.onTour(s)


## Song bars passed since the start, unwrapped across the loop (departures are bar lines).
func _track_bars() -> void:
	var b := clock.bar
	if _bar_last >= 0.0:
		var d := b - _bar_last
		if d < -float(clock.nbars) * 0.5:
			d += float(clock.nbars)
		_bar_abs += maxf(d, 0.0)
	_bar_last = b


func _tick_tour() -> void:
	if mode == Mode.PLAY and _playing and _depart_bar >= 0.0 and _bar_abs >= _depart_bar:
		_depart_bar = -1.0
		_go(_t + 1, true)


func _command(c: String) -> void:
	if _shot:
		return
	var n := exhibits.size()
	if c == "browse":
		_go(1, true)
	elif c == "next":
		if _t <= n:
			_go(_t + 1, _tour != "paused")
	elif c == "prev":
		if _t > 0:
			_go(_t - 1, _tour != "paused")
	elif c == "home":
		_go(n + 1, false)
	elif c.begins_with("goto:"):
		var id := c.substr(5)
		if id == "stage":
			_go(0, false)
			return
		if id == "entrance":
			_go(n + 1, false)
			return
		for i in n:
			if str(exhibits[i]["id"]) == id:
				_go(i + 1, false)
				return
	elif c == "tour:pause":
		if _tour == "touring":
			_pause_tour()
	elif c == "tour:play":
		if _tour == "paused" and _t > 0 and _t <= n:
			_playing = true
			_set_tour("touring")
			if mode == Mode.PLAY:
				_depart_bar = ceilf(_bar_abs + 1.5)
		elif _tour != "touring":
			# at the stage or the end (or paused there): start the tour over
			_go(1, true)


# ---------------------------------------------------------------- free walk

func _move_input() -> Vector2:
	var k := Vector2.ZERO
	if Input.is_physical_key_pressed(KEY_D):
		k.x += 1.0
	if Input.is_physical_key_pressed(KEY_A):
		k.x -= 1.0
	if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP):
		k.y += 1.0
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN):
		k.y -= 1.0
	k += controls.move
	return k.limit_length(1.0)


func _turn_input() -> float:
	var t := 0.0
	if Input.is_physical_key_pressed(KEY_LEFT):
		t += 1.0
	if Input.is_physical_key_pressed(KEY_RIGHT):
		t -= 1.0
	return t


func _tick_play(delta: float) -> void:
	if _tour == "stage" and not is_equal_approx(_aspect(), _stage_aspect):
		_hold_stage()
	var mv := _move_input()
	var turn := _turn_input()
	var fast := 1.0 if Input.is_key_pressed(KEY_SHIFT) else 0.0
	fast = maxf(fast, smoothstep(0.75, 1.0, controls.move.length()) * 0.55)
	var active := mv.length() > 0.01 or turn != 0.0
	var lk: Vector2 = controls.consume_look()
	if active:
		if _walk_idle > 0.5 and bridge != null:
			bridge.onWalk(true)
		_walk_idle = 0.0
		_fov_goal = float(Layout.start_pose(_aspect())["fov"])
		if _tour != "paused":
			_pause_tour()
	else:
		_walk_idle += delta
		if lk != Vector2.ZERO and _tour == "touring":
			_pause_tour()
	player.look(lk.x, lk.y)
	_tick_drift(delta, active or lk != Vector2.ZERO)
	player.step(delta, mv, turn, fast)
	_fov = lerpf(_fov, _fov_goal, 1.0 - exp(-delta * 3.0))
	_state = _player_state()
	_update_focus(delta)


## The held shots drift a little (faintly on the stage, a touch more at the end, barely on an exhibit) so they never freeze.
## It fades out as soon as the visitor takes over, and is off for reduced motion.
func _tick_drift(delta: float, input: bool) -> void:
	var holding := _tour == "stage" or _tour == "touring" or _tour == "end"
	var want := 1.0 if (holding and not input and not _reduced) else 0.0
	_drift_w = move_toward(_drift_w, want, delta * (0.6 if want > 0.0 else 4.0))
	_drift_clock += delta
	var k := _drift_w
	if k <= 0.0:
		_drift = {"pos": Vector3.ZERO, "yaw": 0.0, "pitch": 0.0}
		return
	var amp := 0.3 if _t == 0 else (0.35 if _t > exhibits.size() else 0.2)
	var c := _drift_clock
	_drift = {
		"pos": Vector3(sin(c * 0.31) * 0.34, sin(c * 0.23 + 1.0) * 0.14, sin(c * 0.17 + 2.0) * 0.45) * (amp * k),
		"yaw": sin(c * 0.21 + 0.5) * 1.1 * amp * k,
		"pitch": sin(c * 0.27) * 0.45 * amp * k,
	}


func _update_focus(delta: float) -> void:
	var code := player.focus_code()
	if code == _focus_code:
		_focus_cand = code
		return
	if code != _focus_cand:
		_focus_cand = code
		_focus_cand_t = 0.0
		return
	_focus_cand_t += delta
	if _focus_cand_t >= FOCUS_SETTLE:
		_emit_focus(code, false)


func _emit_focus(code: int, force: bool) -> void:
	if code == _focus_code and not force:
		return
	_focus_code = code
	_focus_cand = code
	_focus_bay = code if code >= 0 else -1
	if code >= 0:
		_t = code + 1
	elif code == Player.FOCUS_STAGE:
		_t = 0
	if bridge != null:
		bridge.onFocus("stage" if code == Player.FOCUS_STAGE else ("" if code < 0 else str(exhibits[code]["id"])))


# ---------------------------------------------------------------- input

func _input(ev: InputEvent) -> void:
	if _shot:
		return
	if ev is InputEventKey:
		var k := ev as InputEventKey
		if k.pressed and not k.echo:
			if k.keycode == KEY_HOME:
				_go(exhibits.size() + 1, false)
		return
	if _mobile:
		if ev is InputEventScreenTouch:
			controls.handle(ev)
		elif ev is InputEventScreenDrag:
			controls.handle(ev)
		return
	# desktop: pointer events come from the mouse (touch is emulated from it, so it is ignored)
	if ev is InputEventMouseButton:
		var m := ev as InputEventMouseButton
		if m.button_index != MOUSE_BUTTON_LEFT:
			return
		if m.pressed:
			_mouse_down = true
			_mouse_moved = false
			_mouse_press = m.position
			_mouse_ms = Time.get_ticks_msec()
		elif _mouse_down:
			_mouse_down = false
			if not _mouse_moved and Time.get_ticks_msec() - _mouse_ms < 500 and mode == Mode.PLAY:
				_tap(m.position)
	elif ev is InputEventMouseMotion:
		var mm := ev as InputEventMouseMotion
		var entered := not _cursor_in
		_cursor_in = true
		_cursor_x = mm.position.x
		if entered:
			return        # the first motion after entering (or loading) can carry a bogus jump
		if _mouse_down and not _mouse_moved:
			if mm.position.distance_to(_mouse_press) <= MOUSE_SLOP:
				return        # still a click, not a look
			_mouse_moved = true
		# the usual game direction: right turns right (yaw falls), up looks up
		_look_pending += Vector2(-mm.relative.x, -mm.relative.y) * MOUSE_DEG_PER_PX


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_MOUSE_EXIT or what == NOTIFICATION_WM_WINDOW_FOCUS_OUT or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		_cursor_in = false
		_mouse_down = false
		_look_pending = Vector2.ZERO


## Frame the art around the page's right-hand details panel: while an exhibit is held (touring or
## paused at it) and the panel covers `_right_inset_css`, turn the view a little to the right so the
## art sits in the middle of the uncovered part. Eased, so the panel opening or closing does not jump.
func _tick_panel(delta: float) -> void:
	var goal := 0.0
	var holding := _t >= 1 and _t <= exhibits.size() and (_tour == "touring" or _tour == "paused")
	if holding and _right_inset_css > 0.0 and not _mobile:
		var vs := get_viewport().get_visible_rect().size
		var css_w := maxf(vs.x * _css_per_unit(), 1.0)
		var frac := clampf(_right_inset_css / css_w, 0.0, 0.6)    # the covered share of the width: the centre moves by half of it
		var tan_h := tan(deg_to_rad(_fov) * 0.5) * (vs.x / maxf(vs.y, 1.0))   # fov is vertical
		goal = -rad_to_deg(atan(frac * tan_h))
	_panel_yaw = lerpf(_panel_yaw, goal, 1.0 - exp(-delta * PANEL_EASE))


## Phones: the bottom sheet covers part of the screen, so while an exhibit is held pitch up (eased)
## so the art sits in the clear part above it. Follows the sheet as its height changes (it opens,
## grows and shrinks), not just at the moment of arrival.
func _tick_sheet(delta: float) -> void:
	var goal := 0.0
	var holding := _t >= 1 and _t <= exhibits.size() and (_tour == "touring" or _tour == "paused")
	if holding and _aspect() < 0.9 and _inset_css > 0.0:
		var vs := get_viewport().get_visible_rect().size
		var cover := clampf(_inset_css / maxf(vs.y * _css_per_unit(), 1.0), 0.0, 0.5)
		goal = -rad_to_deg(atan(cover * tan(deg_to_rad(_fov) * 0.5)))
	_sheet_pitch = lerpf(_sheet_pitch, goal, 1.0 - exp(-delta * SHEET_EASE))


## Is the mouse look a bounded glance (tour shots, glides, the stage hold) rather than a real turn?
func _glancing() -> bool:
	return mode == Mode.TRANS or _tour == "stage" or _tour == "touring"


## Apply the mouse look and edge turning for this frame. Pending look is eased in (light smoothing).
func _tick_look(delta: float) -> void:
	if _mobile:
		return
	var edge_target := 0.0
	if _cursor_in and not _reduced:
		var w := maxf(get_viewport().get_visible_rect().size.x, 1.0)
		var zone := w * EDGE_FRAC
		var depth := 0.0
		if _cursor_x < zone:
			depth = 1.0 - _cursor_x / zone
			edge_target = 1.0
		elif _cursor_x > w - zone:
			depth = 1.0 - (w - _cursor_x) / zone
			edge_target = -1.0
		edge_target *= EDGE_MAX_DEG_S * lerpf(0.4, 1.0, clampf(depth, 0.0, 1.0))
	_edge_vel = move_toward(_edge_vel, edge_target, EDGE_ACCEL * delta)
	var d := _look_pending * (1.0 - exp(-delta * MOUSE_SMOOTH))
	_look_pending -= d
	d.x += _edge_vel * delta
	if _glancing():
		if _glance_return > 0.0:
			_glance *= maxf(_glance_return - delta, 0.0) / _glance_return
			_glance_return = maxf(_glance_return - delta, 0.0)
		_glance = Vector2(clampf(_glance.x + d.x, -GLANCE_YAW, GLANCE_YAW), clampf(_glance.y + d.y, -GLANCE_PITCH, GLANCE_PITCH))
	else:
		_glance_return = 0.0
		if _glance != Vector2.ZERO:
			# the tour was taken over: keep what is on screen as the player's own aim
			player.look(_glance.x, _glance.y)
			_glance = Vector2.ZERO
		if mode == Mode.PLAY:
			player.look(d.x, d.y)
			_state = _player_state()


## A tap or click: if it lands on an exhibit's wall, auto-walk to that bay.
func _tap(p: Vector2) -> void:
	var o := cam.project_ray_origin(p)
	var d := cam.project_ray_normal(p)
	for side: float in [-1.0, 1.0]:
		if absf(d.x) < 0.001:
			continue
		var t := (side * Layout.WALL_X - o.x) / d.x
		if t <= 0.0:
			continue
		var hit := o + d * t
		if hit.y < 0.0 or hit.y > 7.0:
			continue
		for b in exhibits.size():
			if Layout.bay_side(b) == side and absf(hit.z - Layout.bay_z(b)) < 6.0:
				_go(b + 1, false)
				return

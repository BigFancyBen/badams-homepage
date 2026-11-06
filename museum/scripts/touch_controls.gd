extends CanvasLayer
## Touch controls for phones, drawn in Godot above the 3D view. A virtual thumbstick appears where
## a finger lands in the left part of the screen (above the page's bottom sheet), and a finger
## anywhere else drags to look (drag right turns right, drag up looks up). Each finger is tracked by its index, so stick and look work at
## once. A short, still touch is reported as a tap. Styled like the site: thin white strokes, no
## fills, a red accent on the knob.
##
## Usage: main forwards screen touch/drag events to handle(), sets css / inset_css every frame,
## reads move (x strafe, y forward, -1..1) and consume_look() (degrees: x yaw, positive turns left, y pitch, positive up; feed it to Player.look), and listens to tapped.

signal tapped(pos: Vector2)

const STICK_R_CSS := 56.0
const ZONE_FRAC := 0.45
const DEADZONE := 0.12
const SLOP_CSS := 8.0
const TAP_SLOP_CSS := 14.0
const TAP_MS := 500
const LOOK_DEG_PER_CSS := 0.22
const RED := Color(1.0, 0.16, 0.16)

var css: float = 1.0           # CSS pixels per viewport unit
var inset_css: float = 0.0     # height of the page's bottom sheet and nav, CSS px
var enabled: bool = false
var move := Vector2.ZERO       # x = right, y = forward

var _fingers: Dictionary = {}  # index -> {role, start, pos, ms, moved}
var _stick_id: int = -1
var _look_id: int = -1
var _origin := Vector2.ZERO
var _knob := Vector2.ZERO
var _look := Vector2.ZERO
var _used: bool = false
var _ctl: Control


func _init() -> void:
	layer = 10


func _ready() -> void:
	_ctl = Control.new()
	_ctl.set_anchors_preset(Control.PRESET_FULL_RECT)
	_ctl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ctl.draw.connect(_paint)
	add_child(_ctl)


func _vs() -> Vector2:
	return get_viewport().get_visible_rect().size


func _zone_bottom() -> float:
	return _vs().y - inset_css / maxf(css, 0.01)


func _r() -> float:
	return STICK_R_CSS / maxf(css, 0.01)


func _idle_pos() -> Vector2:
	var vs := _vs()
	return Vector2(clampf(vs.x * 0.2, _r() + 10.0, vs.x), maxf(_zone_bottom() - _r() - 28.0 / maxf(css, 0.01), vs.y * 0.3))


func consume_look() -> Vector2:
	var l := _look
	_look = Vector2.ZERO
	return l


## Drop every finger (focus lost, intro skip).
func reset() -> void:
	_fingers.clear()
	_stick_id = -1
	_look_id = -1
	move = Vector2.ZERO
	_look = Vector2.ZERO


func handle(ev: InputEvent) -> void:
	if not enabled:
		return
	if ev is InputEventScreenTouch:
		var t := ev as InputEventScreenTouch
		if t.pressed:
			_press(t.index, t.position)
		else:
			_release(t.index, t.position, t.canceled)
	elif ev is InputEventScreenDrag:
		var d := ev as InputEventScreenDrag
		_drag(d.index, d.position, d.relative)


func _press(idx: int, p: Vector2) -> void:
	var vs := _vs()
	var role := ""
	if _stick_id == -1 and p.x < vs.x * ZONE_FRAC and p.y < _zone_bottom():
		role = "stick"
		_stick_id = idx
		var r := _r()
		_origin = Vector2(clampf(p.x, r + 8.0, vs.x - r - 8.0), minf(p.y, _zone_bottom() - r - 6.0))
		_knob = p
		_apply_stick(p)
	elif _look_id == -1:
		role = "look"
		_look_id = idx
	else:
		return
	_fingers[idx] = {"role": role, "start": p, "ms": Time.get_ticks_msec(), "moved": false}


func _release(idx: int, p: Vector2, canceled: bool) -> void:
	if not _fingers.has(idx):
		return
	var f: Dictionary = _fingers[idx]
	_fingers.erase(idx)
	if idx == _stick_id:
		_stick_id = -1
		move = Vector2.ZERO
	if idx == _look_id:
		_look_id = -1
	if canceled:
		return
	var travelled := ((p - (f["start"] as Vector2)) * css).length()
	if Time.get_ticks_msec() - int(f["ms"]) < TAP_MS and travelled < TAP_SLOP_CSS:
		tapped.emit(p)


func _drag(idx: int, p: Vector2, rel: Vector2) -> void:
	if not _fingers.has(idx):
		return
	var f: Dictionary = _fingers[idx]
	if not bool(f["moved"]) and ((p - (f["start"] as Vector2)) * css).length() > SLOP_CSS:
		f["moved"] = true
	if str(f["role"]) == "stick":
		_apply_stick(p)
		if bool(f["moved"]):
			_used = true
	elif bool(f["moved"]):
		var k := css * LOOK_DEG_PER_CSS
		# as in mobile shooters: drag right turns right (yaw falls), drag up looks up
		_look += Vector2(-rel.x * k, -rel.y * k)


func _apply_stick(p: Vector2) -> void:
	var off := (p - _origin)
	var r := _r()
	if off.length() > r:
		off = off.normalized() * r
	_knob = _origin + off
	var v := off / r
	if v.length() < DEADZONE:
		move = Vector2.ZERO
	else:
		# rescale past the deadzone so it ramps from zero
		move = v.normalized() * ((v.length() - DEADZONE) / (1.0 - DEADZONE))
		move.y = -move.y


func _process(_dt: float) -> void:
	if _ctl != null:
		_ctl.visible = enabled
		if enabled:
			_ctl.queue_redraw()


func _paint() -> void:
	if not enabled:
		return
	var r := _r()
	var w := 1.5 / maxf(css, 0.01)
	if _stick_id == -1:
		if not _used:
			var c := _idle_pos()
			_ctl.draw_arc(c, r, 0.0, TAU, 56, Color(1, 1, 1, 0.16), w, true)
			_ctl.draw_arc(c, r * 0.36, 0.0, TAU, 32, Color(RED.r, RED.g, RED.b, 0.3), w, true)
		return
	_ctl.draw_arc(_origin, r, 0.0, TAU, 56, Color(1, 1, 1, 0.38), w, true)
	_ctl.draw_arc(_origin, r * 0.5, 0.0, TAU, 40, Color(1, 1, 1, 0.14), w, true)
	for a in 4:
		var dir := Vector2.from_angle(float(a) * PI * 0.5)
		_ctl.draw_line(_origin + dir * r * 0.86, _origin + dir * r * 1.0, Color(1, 1, 1, 0.5), w)
	_ctl.draw_arc(_knob, r * 0.36, 0.0, TAU, 32, Color(RED.r, RED.g, RED.b, 0.9), w * 1.6, true)
	_ctl.draw_circle(_knob, 2.5 / maxf(css, 0.01), Color(RED.r, RED.g, RED.b, 0.85))

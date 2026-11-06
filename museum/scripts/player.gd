extends RefCounted
## Player: the first-person walker. Owns position (eye height fixed), yaw/pitch in degrees, smooth
## acceleration, wall/blocker collision with sliding, and which exhibit the player is "at".
##
## Collision: the player is a circle (Layout.PLAYER_R) on the xz plane. Each axis is moved
## separately and refused if the circle would overlap a blocker rect (Layout.blockers: each bay's
## plinth and stanchion line, the columns, the stage deck) or leave the hall, so walking into
## anything slides along it.
##
## Focus: focus_code() is the bay whose art the player is standing level with (within FOCUS_DZ m
## along the hall) and facing (within FOCUS_ANGLE degrees); FOCUS_STAGE near the stage and facing
## it; FOCUS_NONE otherwise.

const Layout := preload("res://scripts/layout.gd")

const FOCUS_NONE := -1
const FOCUS_STAGE := -2
const FOCUS_DZ := 4.0
const FOCUS_ANGLE := 50.0
const WALK := 3.4
const RUN := 6.0
const ACCEL := 14.0
const DECEL := 20.0
const TURN_RATE := 120.0     # arrow-key turn, degrees per second at full speed
const TURN_ACCEL := 480.0    # degrees per second squared (ease-in)
const PITCH_LIMIT := 65.0

var pos := Layout.START_POS
var yaw: float = 0.0
var pitch: float = 0.0
var n_bays: int = 0

var _vel := Vector2.ZERO     # xz velocity
var _turn_vel: float = 0.0
var _blockers: Array[Rect2] = []


func setup(bays: int) -> void:
	n_bays = bays
	_blockers = Layout.blockers(bays)


func set_state(st: Dictionary) -> void:
	pos = st["pos"]
	yaw = wrapf(float(st["yaw"]), -180.0, 180.0)
	pitch = clampf(float(st["pitch"]), -PITCH_LIMIT, PITCH_LIMIT)
	_vel = Vector2.ZERO
	_turn_vel = 0.0
	settle()


func state() -> Dictionary:
	return {"pos": pos, "yaw": yaw, "pitch": pitch}


## Horizontal forward as (x, z).
func forward() -> Vector2:
	var a := deg_to_rad(yaw)
	return Vector2(-sin(a), -cos(a))


func look(d_yaw: float, d_pitch: float) -> void:
	yaw = wrapf(yaw + d_yaw, -180.0, 180.0)
	pitch = clampf(pitch + d_pitch, -PITCH_LIMIT, PITCH_LIMIT)


## move: x = strafe right, y = forward (length <= 1). turn: -1..1, positive turns left.
## fast: 0..1 blends walk speed to run speed.
func step(dt: float, move: Vector2, turn: float, fast: float) -> void:
	_turn_vel = move_toward(_turn_vel, turn * TURN_RATE, TURN_ACCEL * dt)
	yaw = wrapf(yaw + _turn_vel * dt, -180.0, 180.0)
	var f := forward()
	var rt := Vector2(cos(deg_to_rad(yaw)), -sin(deg_to_rad(yaw)))
	var want := f * move.y + rt * move.x
	if want.length() > 1.0:
		want = want.normalized()
	want *= lerpf(WALK, RUN, fast)
	var rate := ACCEL if want.length() > 0.01 else DECEL
	_vel = _vel.move_toward(want, rate * dt)
	# the stage hold is a little above eye height: settle to it once walking starts
	pos.y = move_toward(pos.y, Layout.EYE_H, 1.5 * dt)
	_slide(_vel * dt)


func _slide(d: Vector2) -> void:
	if not _blocked(Vector2(pos.x + d.x, pos.z)):
		pos.x += d.x
	else:
		_vel.x = 0.0
	if not _blocked(Vector2(pos.x, pos.z + d.y)):
		pos.z += d.y
	else:
		_vel.y = 0.0


func _blocked(p: Vector2) -> bool:
	var r := Layout.PLAYER_R
	if absf(p.x) > Layout.HALF_W - r - 0.05 or p.y > Layout.HALL_Z0 - r - 0.05 or p.y < Layout.HALL_Z1 + r:
		return true
	for rc in _blockers:
		if rc.grow(r).has_point(p):
			return true
	return false


## After a teleport or auto-walk: if the player ended up inside a blocker, push out along the
## shortest way.
func settle() -> void:
	var p := Vector2(pos.x, pos.z)
	for rc in _blockers:
		var g := rc.grow(Layout.PLAYER_R)
		if not g.has_point(p):
			continue
		var opts := [
			Vector2(g.position.x - p.x - 0.01, 0.0), Vector2(g.end.x - p.x + 0.01, 0.0),
			Vector2(0.0, g.position.y - p.y - 0.01), Vector2(0.0, g.end.y - p.y + 0.01)]
		var best: Vector2 = opts[0]
		for o: Vector2 in opts:
			if o.length() < best.length():
				best = o
		p += best
	pos.x = p.x
	pos.z = p.y


func focus_code() -> int:
	var f := forward()
	var best := FOCUS_NONE
	var best_a := FOCUS_ANGLE
	for b in n_bays:
		var bz := Layout.bay_z(b)
		if absf(pos.z - bz) > FOCUS_DZ:
			continue
		var to := Vector2(Layout.bay_side(b) * Layout.WALL_X - pos.x, bz - pos.z)
		if to.length() > 14.5:
			continue
		var a := rad_to_deg(absf(f.angle_to(to.normalized())))
		if a < best_a:
			best_a = a
			best = b
	if best >= 0:
		return best
	if pos.z < Layout.ST_Z0 + 22.0 and f.y < -0.34:
		return FOCUS_STAGE
	return FOCUS_NONE

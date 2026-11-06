extends RefCounted
## Layout: the hall's dimensions and where everything sits. Constants and pure functions only,
## no nodes, no state. Owns: hall/bay/stage dimensions, the stop list (entrance, each exhibit id,
## "stage"), per-stop camera poses, the plaque stand frame, capture shot definitions.
##
## The hall runs stage to entrance: exhibit index 0 is the bay nearest the stage (bay_z(0) = BAY0_Z)
## and each next one is BAY_DZ nearer the entrance (13 bays: z -94.0 ... -7.6). Bays alternate walls,
## even indices on the left (-x). The tour order is stage, exhibits 1..n, then END_POSE at the
## entrance looking up at the marquee; the game opens on and holds the stage hold pose.

const HALF_W := 7.0
const WALL_H := 9.0
const BAY0_Z := -94.0
const BAY_DZ := 7.2
const HALL_Z0 := 12.0
const HALL_Z1 := -124.0
const ST_Z0 := -104.0
const ST_Z1 := -123.0
const DECK_H := 1.2
const BALL_Z := -111.0
const MQ_Z := -0.4
const ROT_R := 12.0
const ROT_Z := -117.75
const TRUSS_Y := 8.2
const BALL_Y := 5.2
## the stage's focal point (centre of the deck) and its camera stop
const STAGE_CENTER := Vector3(0.0, 1.2, -112.0)
## art slots on a bay wall: [z offset, max width, max height, centre y]
const ART_SLOTS := [[0.0, 4.8, 3.0, 2.9], [4.4, 2.4, 1.5, 2.9], [-4.4, 2.4, 1.5, 2.9]]
## x of the wall plane the frames hang on
const WALL_X := 6.95
## Free walk: eye height, body radius, where the player starts (just inside the entrance, looking
## down the hall) and the slight upward pitch there.
const EYE_H := 1.65
const PLAYER_R := 0.3
const START_POS := Vector3(0.0, EYE_H, 9.0)
const START_PITCH := 3.0
## The marquee's ink (see signage.gd: PANEL_W 12.4 x ink fraction) is centred here, facing +z.
const SIGN_Y := 6.7
const SIGN_Z := -0.76
const SIGN_HALF_W := 5.9


static func bay_z(b: int) -> float:
	return BAY0_Z + BAY_DZ * float(b)


static func bay_side(b: int) -> float:
	return -1.0 if b % 2 == 0 else 1.0


static func bay_yaw(b: int) -> float:
	return -bay_side(b) * PI * 0.5


## Stop names in order: "entrance", every exhibit id, "stage". Stop index i matches this list.
static func stops(exhibits: Array) -> Array[String]:
	var out: Array[String] = ["entrance"]
	for x in exhibits:
		out.append(str(x["id"]))
	out.append("stage")
	return out


## The bay a stop looks at, or -1 for entrance and stage.
static func bay_of_stop(stop: int, n: int) -> int:
	return stop - 1 if stop >= 1 and stop <= n else -1


## Plaque stand frame: rotation and origin of the leaning stand; the plate sits on it.
static func plaque_rot(b: int) -> Basis:
	return Basis(Vector3.UP, bay_yaw(b)) * Basis(Vector3.RIGHT, -0.9)


static func plaque_org(b: int) -> Vector3:
	return Vector3(bay_side(b) * 4.78, 0.64, bay_z(b))


static func plaque_center(b: int) -> Vector3:
	return plaque_org(b) + plaque_rot(b) * Vector3(0, 0.575, 0.016)


static func plaque_normal(b: int) -> Vector3:
	return plaque_rot(b) * Vector3(0, 0, 1)


## Camera pose for stop i (0 entrance, 1..n exhibits, n+1 stage): {pos, yaw, pitch, fov} in degrees.
static func pose(i: int, aspect: float, n: int) -> Dictionary:
	if i > n:
		return stage_pose(aspect)
	if i <= 0:
		var fov := 60.0
		if aspect < 1.4:
			fov = clampf(2.0 * rad_to_deg(atan(tan(deg_to_rad(36.0)) / aspect)), 60.0, 100.0)
		# portrait: pitch down so the marquee rides in the upper third and the hall fills below
		return {"pos": Vector3(0, 1.8, 9.0), "yaw": 0.0, "pitch": 9.0 if aspect >= 1.4 else 0.0, "fov": fov}
	var b := i - 1
	var side := bay_side(b)
	var tan_h := tan(deg_to_rad(26.0))
	var need_w := 5.8
	var d := clampf(need_w / (2.0 * tan_h * aspect), 8.8, 12.5)
	var fov2 := 52.0
	if 2.0 * d * tan_h * aspect < need_w:
		fov2 = clampf(2.0 * rad_to_deg(atan(need_w / (2.0 * d * aspect))), 52.0, 100.0)
	return {
		"pos": Vector3(side * WALL_X - side * d, 1.8, bay_z(b)),
		"yaw": -side * 90.0,
		"pitch": 2.5,
		"fov": fov2,
	}


## Start pose of the free walk: just inside the entrance, looking down the hall.
static func start_pose(aspect: float) -> Dictionary:
	return {"pos": START_POS, "yaw": 0.0, "pitch": START_PITCH, "fov": float(pose(0, aspect, 1)["fov"])}


## Camera pose looking from pos at target (yaw/pitch in degrees; forward is (-sin yaw, -cos yaw)).
static func look_pose(pos: Vector3, target: Vector3, fov: float) -> Dictionary:
	var d := target - pos
	return {"pos": pos, "yaw": rad_to_deg(atan2(-d.x, -d.z)), "pitch": rad_to_deg(atan2(d.y, Vector2(d.x, d.z).length())), "fov": fov}


## The stage hold: the shot the game opens on and holds until Browse, and the tour starts from. Frames the truss
## and disco ball above, the screen and booth, and the deck front below with room for the fascia
## neon (a little above the floor, centred), from well back in the hall.
static func stage_pose(aspect: float) -> Dictionary:
	if aspect < 1.4:
		return {"pos": Vector3(0.0, 2.3, -96.0), "yaw": 0.0, "pitch": 10.0, "fov": 80.0}
	return {"pos": Vector3(0.0, 2.0, -95.0), "yaw": 0.0, "pitch": 9.0, "fov": 60.0}


## Tour end: at the entrance, looking up at the original marquee (its ink fills the frame width; a
## wider lens in portrait, up to 100 degrees).
static func end_pose(aspect: float) -> Dictionary:
	var pos := Vector3(0.0, 1.8, 11.0)
	var target := Vector3(0.0, SIGN_Y - 0.5, SIGN_Z)
	var dist := pos.z - SIGN_Z
	var fov := clampf(rad_to_deg(2.0 * atan(SIGN_HALF_W * 1.12 / (dist * aspect))), 42.0, 100.0)
	return look_pose(pos, target, fov)


## Control-point offset of a move (a quadratic curve through the midpoint plus half of this): a small crane lift for
## a glide between exhibits, a big lift and pull back up the hall when leaving the stage hold.
static func glide_lift(from_stage: bool) -> Vector3:
	if from_stage:
		return Vector3(-3.0, 7.0, 32.0)
	return Vector3(0.0, 0.7, 0.0)


## Viewing pose for stop i at eye height, kept off the stage blocker (auto-walk target).
static func walk_pose(i: int, aspect: float, n: int) -> Dictionary:
	if i <= 0:
		return start_pose(aspect)
	var p := pose(i, aspect, n)
	var v: Vector3 = p["pos"]
	v.y = EYE_H
	if i > n:
		return p
	p["pos"] = v
	return p


## Walk blockers as xz rects (Rect2 x = world x, y = world z): each bay's plinth and stanchion
## line (everything from the stanchions to the wall), the columns, and the stage deck with its
## steps. The hall walls are handled by the player's bounds.
static func blockers(n: int) -> Array[Rect2]:
	var out: Array[Rect2] = []
	for b in n:
		var side := bay_side(b)
		var x0 := 2.85 if side > 0.0 else -HALF_W - 0.3
		out.append(Rect2(Vector2(x0, bay_z(b) - 3.9), Vector2(HALF_W + 0.3 - 2.85, 7.8)))
		out.append(Rect2(Vector2(-side * 6.5 - 0.5, bay_z(b) - 0.5), Vector2(1.0, 1.0)))
	for sx: float in [-1.0, 1.0]:
		out.append(Rect2(Vector2(sx * 6.5 - 0.5, 3.5), Vector2(1.0, 1.0)))
	# the stage deck, from the front of its steps to the back wall
	out.append(Rect2(Vector2(-HALF_W - 0.3, HALL_Z1 - 1.0), Vector2(HALF_W * 2.0 + 0.6, ST_Z0 + 1.6 - HALL_Z1 + 1.0)))
	return out


## Clip a ray from o along d to the hall's walls, floor and ceiling.
static func clip_len(o: Vector3, d: Vector3, maxl: float) -> float:
	var l := maxl
	if d.x > 0.001:
		l = minf(l, (HALF_W - 0.05 - o.x) / d.x)
	elif d.x < -0.001:
		l = minf(l, (-HALF_W + 0.05 - o.x) / d.x)
	if d.y < -0.001:
		l = minf(l, -o.y / d.y)
	elif d.y > 0.001:
		l = minf(l, (WALL_H - 0.05 - o.y) / d.y)
	return maxf(l, 0.1)


## Names accepted by --shot=. bayN / plaqueN take a 1-based exhibit number.
const SHOT_NAMES := ["entrance", "break", "bayN", "plaqueN", "marquee", "stage", "stage_break", "stage_drop", "hall_drop", "tour_end", "pull_mid"]


## Capture shot definition: {"t": song seconds, "stop": stop index, "cam": Transform3D (optional),
## "fov": float (with cam)}. Without "cam" the stop's normal pose is used. Empty when unknown.
## The drop runs t=60..90 s, the break t=45..60 s.
static func shot(shot_name: String, n: int) -> Dictionary:
	if shot_name == "entrance":
		return {"t": 70.0, "stop": 0}
	if shot_name == "break":
		return {"t": 50.0, "stop": 0}
	if shot_name == "stage":
		return {"t": 36.0, "stop": n + 1}
	if shot_name == "stage_break":
		return {"t": 57.0, "stop": n + 1}
	if shot_name == "stage_drop":
		return {"t": 72.0, "stop": n + 1}
	if shot_name == "hall_drop":
		var from := Vector3(0.0, 2.6, -48.0)
		return {"t": 70.0, "stop": 0, "fov": 70.0, "cam": Transform3D(Basis.IDENTITY, from).looking_at(Vector3(0.0, 3.4, -110.0), Vector3.UP)}
	if shot_name == "tour_end":
		return {"t": 70.0, "stop": 0, "end": true}
	if shot_name == "pull_mid":
		return {"t": 70.0, "stop": 0, "pull": 0.5}
	if shot_name == "marquee":
		var mf := Vector3(0.0, 3.6, 6.5)
		return {"t": 70.0, "stop": 0, "fov": 55.0, "cam": Transform3D(Basis.IDENTITY, mf).looking_at(Vector3(0.0, 6.0, MQ_Z), Vector3.UP)}
	if shot_name.begins_with("bay") and shot_name.substr(3).is_valid_int():
		return {"t": 70.0, "stop": clampi(int(shot_name.substr(3)), 1, n)}
	if shot_name.begins_with("plaque") and shot_name.substr(6).is_valid_int():
		var stop := clampi(int(shot_name.substr(6)), 1, n)
		var b := stop - 1
		var c := plaque_center(b)
		var pf := c + plaque_normal(b) * 2.4
		return {"t": 70.0, "stop": stop, "fov": 40.0, "cam": Transform3D(Basis.IDENTITY, pf).looking_at(c, Vector3.UP)}
	return {}

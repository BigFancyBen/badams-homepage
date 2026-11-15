extends RefCounted
## Layout: the hall's dimensions and where everything sits. Owns: hall/stage dimensions, the gallery
## wall plan, the stop list (entrance, each exhibit id, "stage"), per-stop camera poses, the plaque
## stand frame, capture shot definitions. Constants and pure functions, plus the wall plan, which
## plan() works out once from exhibits.json before anything is built or placed.
##
## The gallery is one wall. Every exhibit hangs on the right-hand wall looking toward the stage (+x),
## so going from one project to the next is a slide along that wall with the camera square on to it,
## never a turn. Exhibit 0 is nearest the stage and each next one is further toward the entrance,
## which is to the right on screen. Each exhibit's pictures are arranged to suit their shapes
## (arrange(): one picture on its own, the first above the rest, or the first beside the rest
## stacked) at the largest size that fits an art box between the dado and the picture rail; the
## exhibits are then spread along the wall with equal gaps and a column standing in each gap. The
## opposite wall is a plain colonnade.
##
## The tour order is stage, exhibits 1..n, then END_POSE at the entrance looking up at the marquee;
## the game opens on and holds the stage hold pose.

const HALF_W := 7.0
const WALL_H := 9.0
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
## The gallery wall (+x): the side every exhibit is on, the x the camera measures its distance from,
## and the plane the pictures hang in (a little off the wall).
const SIDE := 1.0
const WALL_X := 6.95
const PIC_X := 6.92
## The run of gallery wall the exhibits are spread along: from clear of the stage steps to far
## enough inside the portal that the back of the marquee stays out of the last exhibit's shot.
const RUN_Z0 := -101.0
const RUN_Z1 := -5.5
## Every exhibit's pictures, frames included, fit in a box this size (metres): no wider than BOX_W,
## and between the dado rail and the picture rail, centred at ART_CY.
const BOX_W := 6.2
const BOX_H := 4.3
const ART_CY := 3.47
## From a picture's edge to its frame's outer edge (mat board and moulding, see Architecture.frame),
## and between two neighbouring frames.
const FRAME_B := 0.29
const FRAME_GAP := 0.32
## The shape each arrangement aims for (box width / height). Squarish suits both the part of a
## desktop view the details panel leaves clear and a phone held upright.
const TARGET_ASPECT := 1.0
## The gaps between exhibits along the wall (a column stands in each).
const GAP_MIN := 2.2
const GAP_MAX := 4.5
## Exhibit shots: the vertical lens in landscape (portrait_fov widens it on a narrow screen), and the
## room left around an exhibit's box when it is fitted into the clear part of the view (box size times
## these).
const GALLERY_FOV := 50.0
const FIT_W := 1.2
const FIT_H := 1.34
## How close to the wall the exhibit camera may come, and how far back it may stand (still well in
## the hall, clear of the colonnade).
const D_MIN := 4.2
const D_MAX := 12.0
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
## Camera3D keeps a fixed vertical FOV, so a tall phone screen collapses the horizontal view to a
## sliver. Every pose's "fov" is therefore the vertical FOV for the screen's aspect: landscape poses use
## their authored value, portrait ones are derived from a horizontal FOV (see portrait_fov) or a width to
## fit, and never above MAX_V_FOV (past it the picture fisheyes, so the camera pulls back instead).
const MAX_V_FOV := 112.0
## horizontal FOV a 60 degree landscape lens becomes in portrait (zoomed shots scale with it)
const PORTRAIT_H_FOV := 76.0

## The wall plan (plan()): per exhibit its centre along the wall, its box (frame edges: width along
## the wall, height) and its pictures; the columns between exhibits; the gap used.
static var _z := PackedFloat32Array()
static var _box: Array[Vector2] = []
static var _pics: Array = []
static var _cols := PackedFloat32Array()
static var _gap: float = GAP_MIN


# ---------------------------------------------------------------- the wall plan

## Work out the wall plan for these exhibits (exhibits.json: each exhibit's "sizes", the pixel size
## of each picture, in "textures" order). Call once, before anything asks where an exhibit is.
static func plan(exhibits: Array) -> void:
	var run := RUN_Z1 - RUN_Z0
	var groups: Array = []
	var gap := GAP_MAX
	# more exhibits than the wall holds at GAP_MIN: shrink every box a little until they fit
	var k := 1.0
	while true:
		groups.clear()
		var total := 0.0
		for x in exhibits:
			var g := arrange(_aspects(x), Vector2(BOX_W, BOX_H) * k)
			groups.append(g)
			total += (g["size"] as Vector2).x
		gap = (run - total) / float(maxi(exhibits.size() - 1, 1))
		if gap >= GAP_MIN or k <= 0.5:
			break
		k -= 0.04
	gap = clampf(gap, GAP_MIN, GAP_MAX)
	_z = PackedFloat32Array()
	_box.clear()
	_pics.clear()
	_cols = PackedFloat32Array()
	_gap = gap
	var used := -gap
	for g in groups:
		used += (g["size"] as Vector2).x + gap
	var z := RUN_Z0 + maxf(run - used, 0.0) * 0.5
	for b in groups.size():
		var sz: Vector2 = groups[b]["size"]
		_z.append(z + sz.x * 0.5)
		_box.append(sz)
		_pics.append(groups[b]["pics"])
		z += sz.x + gap
		if b < groups.size() - 1:
			_cols.append(z - gap * 0.5)


## The aspect (width / height) of each of an exhibit's pictures, at most three, from its "sizes".
static func _aspects(x: Dictionary) -> Array[float]:
	var out: Array[float] = []
	var sizes: Array = x.get("sizes", [])
	var count := mini((x.get("textures", []) as Array).size(), 3)
	for i in count:
		var a := 16.0 / 9.0
		if i < sizes.size() and (sizes[i] as Array).size() == 2 and float(sizes[i][1]) > 0.0:
			a = float(sizes[i][0]) / float(sizes[i][1])
		out.append(a)
	if out.is_empty():
		out.append(16.0 / 9.0)
	return out


## Lay out one exhibit's pictures (aspects a; the first is the lead picture) to fit box: each
## arrangement at the largest size that fits, keeping the one whose shape is nearest TARGET_ASPECT.
## Returns {"size": Vector2 frame edges (along the wall, up), "pics": Array of [Vector2 centre from the
## box's centre (along the wall toward the entrance, up), Vector2 picture size]}.
static func arrange(a: Array[float], box: Vector2) -> Dictionary:
	var kinds: Array[String] = ["single"]
	if a.size() > 1:
		kinds = ["top", "side"]
	var best: Dictionary = {}
	var best_score := INF
	for kind in kinds:
		# the box grows with the lead picture's height s: find the largest s that still fits
		var lo := 0.05
		var hi := 8.0
		for _i in 40:
			var mid := (lo + hi) * 0.5
			if _fits(_arrangement(kind, a, mid)["size"], box):
				lo = mid
			else:
				hi = mid
		var g := _arrangement(kind, a, lo)
		if not g["ok"]:
			continue
		var sz: Vector2 = g["size"]
		var score := absf(log(sz.x / sz.y / TARGET_ASPECT))
		if score < best_score:
			best_score = score
			best = g
	if best.is_empty():
		var only: Array[float] = [a[0]]
		return arrange(only, box)
	return best


static func _fits(size: Vector2, box: Vector2) -> bool:
	return size.x <= box.x + 0.0001 and size.y <= box.y + 0.0001


## One arrangement with the lead picture s metres tall: {"ok", "size", "pics"} (see arrange()).
##   single: the one picture.
##   top: the lead picture above, the rest in a row under it, the row as wide as the lead picture's
##        frame where it can be (its pictures 35-50% as tall).
##   side: the lead picture on the left, the rest stacked on its right, the stack as tall as it.
static func _arrangement(kind: String, a: Array[float], s: float) -> Dictionary:
	var b := FRAME_B
	var gap := FRAME_GAP
	var lead := Vector2(a[0] * s, s)
	var lead_o := lead + Vector2(b, b) * 2.0
	if kind == "single":
		return {"ok": true, "size": lead_o, "pics": [[Vector2.ZERO, lead]]}
	var rest := a.slice(1)
	var k := float(rest.size())
	var sum_r := 0.0
	for r in rest:
		sum_r += r
	var pics: Array = []
	if kind == "top":
		var hr := (lead_o.x - k * 2.0 * b - (k - 1.0) * gap) / sum_r
		hr = clampf(hr, 0.35 * s, 0.5 * s)
		var row_w := sum_r * hr + k * 2.0 * b + (k - 1.0) * gap
		var row_h := hr + 2.0 * b
		var size := Vector2(maxf(lead_o.x, row_w), lead_o.y + gap + row_h)
		pics.append([Vector2(0.0, size.y * 0.5 - lead_o.y * 0.5), lead])
		var x := -row_w * 0.5
		for r in rest:
			var pw: float = r * hr
			pics.append([Vector2(x + b + pw * 0.5, -size.y * 0.5 + row_h * 0.5), Vector2(pw, hr)])
			x += pw + 2.0 * b + gap
		return {"ok": true, "size": size, "pics": pics}
	# side
	var sh := 0.62 * s if rest.size() == 1 else (lead_o.y - (k - 1.0) * gap) / k - 2.0 * b
	var ok := sh >= 0.25
	sh = maxf(sh, 0.05)
	var col_w := 0.0
	for r in rest:
		col_w = maxf(col_w, r * sh)
	var col_o := col_w + 2.0 * b
	var stack_h := k * (sh + 2.0 * b) + (k - 1.0) * gap
	var size2 := Vector2(lead_o.x + gap + col_o, maxf(lead_o.y, stack_h))
	pics.append([Vector2(-size2.x * 0.5 + lead_o.x * 0.5, 0.0), lead])
	var cx := size2.x * 0.5 - col_o * 0.5
	var y := stack_h * 0.5
	for r in rest:
		pics.append([Vector2(cx, y - (sh + 2.0 * b) * 0.5), Vector2(r * sh, sh)])
		y -= sh + 2.0 * b + gap
	return {"ok": ok, "size": size2, "pics": pics}


static func count() -> int:
	return _z.size()


static func bay_z(b: int) -> float:
	return _z[b] if b >= 0 and b < _z.size() else RUN_Z0


## Every exhibit is on the gallery wall (+x).
static func bay_side(_b: int) -> float:
	return SIDE


static func bay_yaw(_b: int) -> float:
	return -SIDE * PI * 0.5


## Exhibit b's box: the width (along the wall) and height its frames take up, centred at (bay_z(b), ART_CY).
static func bay_size(b: int) -> Vector2:
	return _box[b] if b >= 0 and b < _box.size() else Vector2(BOX_W, BOX_H)


## Exhibit b's pictures: Array of [Vector2 centre from the box centre (along the wall toward the
## entrance, up), Vector2 picture size], in "textures" order.
static func bay_pics(b: int) -> Array:
	return _pics[b] if b >= 0 and b < _pics.size() else []


## z of the columns between neighbouring exhibits (one on each wall).
static func columns() -> PackedFloat32Array:
	return _cols


## The exhibit whose stretch of wall (its box and half the gap either side) holds z, or -1.
static func bay_at(z: float) -> int:
	for b in _z.size():
		if absf(z - _z[b]) <= _box[b].x * 0.5 + _gap * 0.5:
			return b
	return -1


# ---------------------------------------------------------------- stops and poses

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
	return Vector3(bay_side(b) * 4.33, 0.64, bay_z(b))


static func plaque_center(b: int) -> Vector3:
	return plaque_org(b) + plaque_rot(b) * Vector3(0, 0.575, 0.016)


static func plaque_normal(b: int) -> Vector3:
	return plaque_rot(b) * Vector3(0, 0, 1)


## The vertical FOV to use at this aspect for a lens authored as v_land degrees vertical in landscape.
## Landscape (aspect >= 1) is returned unchanged. Narrower screens widen the lens so the horizontal view
## stays near PORTRAIT_H_FOV (scaled by the lens: a 40 degree close-up stays a close-up), eased out
## between aspect 0.6 and 1.0 so there is no jump, and capped at MAX_V_FOV.
static func portrait_fov(v_land: float, aspect: float) -> float:
	if aspect >= 1.0:
		return v_land
	var k := tan(deg_to_rad(PORTRAIT_H_FOV * 0.5)) / tan(deg_to_rad(30.0))
	k = lerpf(k, 1.0, clampf((aspect - 0.6) / 0.4, 0.0, 1.0))
	return minf(2.0 * rad_to_deg(atan(tan(deg_to_rad(v_land) * 0.5) * k / aspect)), MAX_V_FOV)


## Camera pose for stop i (0 entrance, 1..n exhibits, n+1 stage): {pos, yaw, pitch, fov} in degrees.
## Exhibits are framed for a view with nothing over it (see gallery_pose for the page's panels).
static func pose(i: int, aspect: float, n: int) -> Dictionary:
	if i > n:
		return stage_pose(aspect)
	if i <= 0:
		var fov := 60.0
		if aspect < 1.4:
			fov = clampf(2.0 * rad_to_deg(atan(tan(deg_to_rad(36.0)) / aspect)), 60.0, MAX_V_FOV)
		# portrait: pitch down so the marquee rides in the upper third and the hall fills below
		return {"pos": Vector3(0, 1.8, 9.0), "yaw": 0.0, "pitch": 9.0 if aspect >= 1.4 else 0.0, "fov": fov}
	return gallery_pose(i - 1, aspect, 0.0, 0.0)


## The shot of exhibit b: square on to the wall, its box (with room around it, FIT_W x FIT_H) fitted
## into the part of the view the page leaves clear, and centred in it. side: the share of the view's
## width covered at the right (the desktop details panel); bottom: the share of its height covered at
## the bottom (the phone sheet and buttons). Both are met by moving the camera (along the wall, and
## up), never by turning it, so the wall stays square on to the screen and its verticals upright.
static func gallery_pose(b: int, aspect: float, side: float, bottom: float) -> Dictionary:
	var fov := portrait_fov(GALLERY_FOV, aspect)
	var tv := tan(deg_to_rad(fov) * 0.5)
	var th := tv * aspect
	var sd := clampf(side, 0.0, 0.6)
	var bt := clampf(bottom, 0.0, 0.5)
	var sz := bay_size(b)
	var d := maxf(sz.x * FIT_W / (2.0 * th * (1.0 - sd)), sz.y * FIT_H / (2.0 * tv * (1.0 - bt)))
	d = clampf(d, D_MIN, D_MAX)
	# the box's centre lands in the middle of the clear part: -sd across (NDC), +bt up
	var z := bay_z(b) + SIDE * sd * d * th
	var y := ART_CY + bt * d * tv
	return {"pos": Vector3(SIDE * (WALL_X - d), y, z), "yaw": -SIDE * 90.0, "pitch": 0.0, "fov": fov}


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
		return {"pos": Vector3(0.0, 2.3, -99.0), "yaw": 0.0, "pitch": 9.0, "fov": portrait_fov(52.0, aspect)}
	return {"pos": Vector3(0.0, 2.0, -95.0), "yaw": 0.0, "pitch": 9.0, "fov": 60.0}


## Tour end: at the entrance, looking up at the original marquee (its ink fills the frame width; a
## wider lens in portrait, up to MAX_V_FOV).
static func end_pose(aspect: float) -> Dictionary:
	var pos := Vector3(0.0, 1.8, 11.0)
	var target := Vector3(0.0, SIGN_Y - 0.5, SIGN_Z)
	var dist := pos.z - SIGN_Z
	var fov := clampf(rad_to_deg(2.0 * atan(SIGN_HALF_W * 1.12 / (dist * aspect))), 42.0, MAX_V_FOV)
	return look_pose(pos, target, fov)


## Control-point offset of a timed move (a quadratic curve through the midpoint plus half of this):
## leaving or returning to the stage hold, a short step back up the hall while the camera turns to
## the wall; anything else (a flight in free roam, the walk to the marquee), a slight rise. Moves from
## one exhibit to the next do not use this: they slide along the wall (main.gd).
static func glide_lift(stage_move: bool) -> Vector3:
	if stage_move:
		return Vector3(-1.6, 1.0, 6.0)
	return Vector3(0.0, 0.35, 0.0)


## Walk blockers as xz rects (Rect2 x = world x, y = world z): each exhibit's plinth and stanchion
## line (everything from the stanchions to the wall, along its box), the columns, and the stage deck
## with its steps. The hall walls are handled by the player's bounds.
static func blockers(n: int) -> Array[Rect2]:
	var out: Array[Rect2] = []
	for b in mini(n, _z.size()):
		var hw := bay_size(b).x * 0.5 + 0.3
		out.append(Rect2(Vector2(2.85, bay_z(b) - hw), Vector2(HALF_W + 0.3 - 2.85, hw * 2.0)))
	for z in _cols:
		for sx: float in [-1.0, 1.0]:
			out.append(Rect2(Vector2(sx * 6.5 - 0.5, z - 0.5), Vector2(1.0, 1.0)))
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


## Names accepted by --shot=. bayN / plaqueN take a 1-based exhibit number; glideN is halfway from
## exhibit N to exhibit N+1.
const SHOT_NAMES := ["entrance", "break", "bayN", "glideN", "plaqueN", "marquee", "stage", "stage_break", "stage_drop", "hall_drop", "tour_end", "pull_mid"]


## Capture shot definition: {"t": song seconds, "stop": stop index, "cam": Transform3D (optional),
## "fov": float (with cam), "glide": float (optional, the way on to the next exhibit)}. Without
## "cam" the stop's normal pose is used. Empty when unknown. The drop runs t=60..90 s, the break t=45..60 s.
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
	if shot_name.begins_with("glide") and shot_name.substr(5).is_valid_int():
		return {"t": 70.0, "stop": clampi(int(shot_name.substr(5)), 1, maxi(n - 1, 1)), "glide": 0.5}
	if shot_name.begins_with("plaque") and shot_name.substr(6).is_valid_int():
		var stop := clampi(int(shot_name.substr(6)), 1, n)
		var b := stop - 1
		var c := plaque_center(b)
		var pf := c + plaque_normal(b) * 2.4
		return {"t": 70.0, "stop": stop, "fov": 40.0, "cam": Transform3D(Basis.IDENTITY, pf).looking_at(c, Vector3.UP)}
	return {}

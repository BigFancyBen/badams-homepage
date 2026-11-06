extends RefCounted
## Stage: the festival main stage at the far end of the hall. Owns the deck with its skirt and
## steps, the DJ riser and booth, the LED screen, three layered box-truss rows of movers, strobe
## bars and blinders, the flank walls of stacked fixtures, the front towers with line arrays, the
## lighting arch, subs and wedges, and the mirror ball (stage_ball.gd). All show logic for them
## lives here: the rig wakes through the break, the drop hits with chases, fan-outs, ballyhoo,
## strobe walls and screen hits. No plaque or label. Layout.STAGE_CENTER / ST_Z0 / ST_Z1 place it.

const Layout := preload("res://scripts/layout.gd")
const Materials := preload("res://scripts/materials.gd")
const Architecture := preload("res://scripts/architecture.gd")
const Fixtures := preload("res://scripts/fixtures.gd")
const Clock := preload("res://scripts/clock.gd")
const Post := preload("res://scripts/post.gd")
const Kit := preload("res://scripts/stage_kit.gd")
const Ball := preload("res://scripts/stage_ball.gd")
const Dj := preload("res://scripts/stage_dj.gd")
const Sign := preload("res://scripts/stage_sign.gd")

# stage-only constants
const SCR_C := Vector3(0.0, 5.3, -122.94)
const SCR_HALF := Vector2(5.8, 3.2)
const ROW_Z: Array[float] = [-109.6, -113.6, -117.6]
const ROW_Y: Array[float] = [8.25, 7.05, 5.95]
const MOV_X: Array[float] = [-4.75, -2.85, -0.95, 0.95, 2.85, 4.75]
const GAP_X: Array[float] = [-5.7, -3.8, -1.9, 0.0, 1.9, 3.8, 5.7]
const ARCH_R := 6.2
const ARCH_C := Vector3(0.0, 2.4, -105.5)
const FLANK_Z := -121.7
const RED := Color(1.0, 0.06, 0.04)

static var _mobile: bool = false
static var _screen_mat: ShaderMaterial
static var _booth_mat: ShaderMaterial
# movers
static var _m_pos: Array[Vector3] = []
static var _m_row: Array[int] = []
static var _m_u: Array[float] = []
static var _m_grp: Array[int] = []
static var _m_flank: Array[bool] = []
# strobe units (cells in _s_*), blinder units, pixel cells
static var _su_pos: Array[Vector3] = []
static var _su_grp: Array[int] = []
static var _s_idx: Array[int] = []
static var _s_unit: Array[int] = []
static var _bu_pos: Array[Vector3] = []
static var _bu_grp: Array[int] = []
static var _b_idx: Array[int] = []
static var _b_unit: Array[int] = []
static var _p_idx: Array[int] = []
static var _p_ph: Array[float] = []
static var _p_kind: Array[int] = []
static var _p_grp: Array[int] = []


static func build(root: Node3D) -> void:
	_mobile = Post.tier == Post.Tier.MOBILE
	for a in [_m_pos, _m_row, _m_u, _m_grp, _m_flank, _su_pos, _su_grp, _s_idx, _s_unit, _bu_pos, _bu_grp, _b_idx, _b_unit, _p_idx, _p_ph, _p_kind, _p_grp]:
		a.clear()
	Kit.reset()
	var hw := Layout.HALF_W
	var wh := Layout.WALL_H
	var z0 := Layout.ST_Z0
	var z1 := Layout.ST_Z1
	var dh := Layout.DECK_H
	var dz := (z0 + z1) * 0.5
	var dl := z0 - z1
	# ---- deck, skirt, steps
	var deck := Architecture.mi(root, Architecture.box(Vector3(hw * 2.0, dh, dl)), Kit.deck_mat(), Vector3(0, dh * 0.5, dz))
	deck.name = "StageDeck"
	# skirt either side of the sign panel (the steps sit at the two ends, so the fascia centre is free)
	var sk0 := 3.95
	for sx in [-1.0, 1.0]:
		Kit.box("rubber", Vector3(hw - sk0, dh - 0.02, 0.08), Vector3(sx * (sk0 + (hw - sk0) * 0.5), (dh - 0.02) * 0.5, z0 + 0.04), Basis.IDENTITY, 0.8, 0.8, 0.0)
	Kit.box("rubber", Vector3(hw * 2.0, 0.07, 0.14), Vector3(0, dh - 0.02, z0 + 0.07), Basis.IDENTITY, 1.1, 0.3, 0.0)
	var nstep := 4
	for sx in [-1.0, 1.0]:
		var scx: float = sx * 5.3
		for j in nstep:
			var topy := 0.3 * float(j + 1)
			var zc := z0 + 0.4 * float(nstep - j) - 0.2
			Kit.box("rubber", Vector3(2.2, topy, 0.4), Vector3(scx, topy * 0.5, zc), Basis.IDENTITY, 1.0, 0.7, 0.0)
			for k in 4:
				var i := Kit.px(Vector3(scx - 0.825 + 0.55 * float(k), topy - 0.03, zc + 0.205), 0.48, 0.045)
				_p_idx.append(i)
				_p_ph.append(float(j) * 1.1 + float(k) * 0.12)
				_p_kind.append(3)
				_p_grp.append(0)
		# handrails along the steps, inner and outer
		for rx in [scx - 1.15, scx + 1.15]:
			Kit.bar(Vector3(rx, 0.9, z0 + 1.7), Vector3(rx, 2.1, z0 + 0.1), 0.05)
			Kit.bar(Vector3(rx, 0.0, z0 + 1.7), Vector3(rx, 0.9, z0 + 1.7), 0.05)
			Kit.bar(Vector3(rx, 1.2, z0 + 0.1), Vector3(rx, 2.1, z0 + 0.1), 0.05)
	# deck edge LED strips (top lip and underglow)
	for k in 28:
		var x := -6.75 + 0.5 * float(k)
		var i := Kit.px(Vector3(x, dh - 0.02, z0 + 0.145), 0.46, 0.05)
		_p_idx.append(i)
		_p_ph.append(float(k) * 0.35)
		_p_kind.append(2)
		_p_grp.append(0)
		var i2 := Kit.px(Vector3(x, 0.05, z0 + 0.1), 0.46, 0.05)
		_p_idx.append(i2)
		_p_ph.append(float(k) * 0.35 + 1.0)
		_p_kind.append(2)
		_p_grp.append(0)
	# ---- back wall, screen, frame
	Architecture.mi(root, Architecture.box(Vector3(hw * 2.0 + 0.8, wh, 0.4)), Materials.get_mat("wall"), Vector3(0, wh * 0.5, z1 - 0.2))
	_screen_mat = Kit.screen_mat("screen", Vector2(96.0, 52.0))
	var sq := QuadMesh.new()
	sq.size = SCR_HALF * 2.0
	Architecture.mi(root, sq, _screen_mat, SCR_C)
	var fx := SCR_HALF.x
	var fy := SCR_HALF.y
	Kit.box("rubber", Vector3(fx * 2.0 + 0.7, 0.35, 0.3), SCR_C + Vector3(0, fy + 0.17, 0.12), Basis.IDENTITY, 0.8, 0.5, 0.0)
	Kit.box("rubber", Vector3(fx * 2.0 + 0.7, 0.35, 0.3), SCR_C + Vector3(0, -fy - 0.17, 0.12), Basis.IDENTITY, 0.8, 0.5, 0.0)
	for sx in [-1.0, 1.0]:
		Kit.box("rubber", Vector3(0.35, fy * 2.0, 0.3), SCR_C + Vector3(sx * (fx + 0.17), 0, 0.12), Basis.IDENTITY, 0.8, 0.5, 0.0)
	# floor of the screen: a black plinth the panel stands on
	Kit.box("rubber", Vector3(hw * 2.0, SCR_C.y - fy - 0.35 - dh, 0.5), Vector3(0, dh + (SCR_C.y - fy - 0.35 - dh) * 0.5, z1 + 0.25), Basis.IDENTITY, 0.5, 0.8, 0.0)
	# ---- the three layered truss rows
	for r in 3:
		var y: float = ROW_Y[r]
		var z: float = ROW_Z[r]
		Kit.truss(Vector3(-6.6, y, z), Vector3(6.6, y, z), 0.25, 0.25, 0.5)
		for x in [-5.7, -1.9, 1.9, 5.7]:
			Kit.box("steel", Vector3(0.34, 0.4, 0.34), Vector3(x, y + 0.5, z), Basis.IDENTITY, 1.0, 0.4)
			if 9.0 - (y + 0.7) > 0.05:
				Kit.bar(Vector3(x, y + 0.7, z), Vector3(x, 9.0, z), 0.04)
		# movers hung under the bottom chord
		for k in MOV_X.size():
			var x: float = MOV_X[k]
			var hy := y - 0.25 - 0.45
			Kit.box("steel", Vector3(0.3, 0.1, 0.3), Vector3(x, y - 0.3, z), Basis.IDENTITY, 1.0, 0.4)
			for sx in [-1.0, 1.0]:
				Kit.box("steel", Vector3(0.05, 0.48, 0.1), Vector3(x + sx * 0.2, hy + 0.08, z), Basis.IDENTITY, 1.0, 0.4)
			_m_pos.append(Vector3(x, hy, z))
			_m_row.append(r)
			_m_u.append(float(k) / 2.5 - 1.0)
			_m_grp.append(r)
			_m_flank.append(false)
		# a pixel line along the front face of the truss
		for k in 26:
			var i := Kit.px(Vector3(-6.25 + 0.5 * float(k), y, z + 0.275), 0.42, 0.06)
			_p_idx.append(i)
			_p_ph.append(float(k) * 0.45 + float(r) * 2.0)
			_p_kind.append(0)
			_p_grp.append(r)
		# vertical pixel droppers at each end
		for sx in [-1.0, 1.0]:
			for k in 6:
				var i := Kit.px(Vector3(sx * 6.45, y - 0.45 - 0.22 * float(k), z + 0.27), 0.08, 0.18)
				_p_idx.append(i)
				_p_ph.append(float(k) * 0.5 + float(r))
				_p_kind.append(0)
				_p_grp.append(r)
		# strobe bars (rows 0 and 2) / blinder banks (row 1) hung in the gaps
		for gx in GAP_X:
			var by := y - 0.25 - 0.12
			var n := Vector3(0, -0.3, 1.0).normalized()
			if r == 1:
				if absf(gx) > 4.0:
					continue
				Kit.box("steel", Vector3(0.62, 0.62, 0.22), Vector3(gx, y - 0.25 - 0.34, z + 0.18), Basis.IDENTITY, 1.0, 0.4)
				var u := _bu_pos.size()
				_bu_pos.append(Vector3(gx, y - 0.6, z + 0.3))
				_bu_grp.append(1)
				for cx in [-1.0, 1.0]:
					for cy in [-1.0, 1.0]:
						_b_idx.append(Kit.px(Vector3(gx + cx * 0.14, y - 0.59 + cy * 0.14, z + 0.3), 0.23, 0.23, n))
						_b_unit.append(u)
			else:
				if r == 0 and absf(absf(gx) - 3.8) < 0.1:
					continue
				Kit.box("steel", Vector3(1.24, 0.18, 0.16), Vector3(gx, by, z + 0.2), Basis.IDENTITY, 1.0, 0.4)
				var u2 := _su_pos.size()
				_su_pos.append(Vector3(gx, by, z + 0.3))
				_su_grp.append(r)
				for k in 6:
					_s_idx.append(Kit.px(Vector3(gx - 0.5 + 0.2 * float(k), by, z + 0.285), 0.17, 0.12, n))
					_s_unit.append(u2)
	# ---- flank walls: stacked fixtures either side of the screen
	for sx in [-1.0, 1.0]:
		for sp in 2:
			var x: float = sx * (6.45 - 1.05 * float(sp))
			Kit.truss(Vector3(x, dh, FLANK_Z), Vector3(x, 8.85, FLANK_Z), 0.25, 0.25, 0.5)
			for i in 10:
				var y := 1.95 + 0.74 * float(i)
				var typ := (i + sp * 2) % 4
				var fz := FLANK_Z + 0.34
				Kit.bar(Vector3(x, y, FLANK_Z + 0.2), Vector3(x, y, FLANK_Z + 0.34), 0.06)
				if typ == 0:
					var hp := Vector3(x, y, FLANK_Z + 0.78)
					Kit.box("steel", Vector3(0.3, 0.1, 0.3), Vector3(x, y + 0.3, FLANK_Z + 0.5), Basis.IDENTITY, 1.0, 0.4)
					Kit.bar(Vector3(x, y + 0.3, FLANK_Z + 0.3), Vector3(x, y + 0.3, FLANK_Z + 0.6), 0.07)
					for sy in [-1.0, 1.0]:
						Kit.box("steel", Vector3(0.1, 0.5, 0.05), Vector3(x + sy * 0.2, y + 0.05, FLANK_Z + 0.78), Basis.IDENTITY, 1.0, 0.4)
					_m_pos.append(hp)
					_m_row.append(1)
					_m_u.append(-sx * 0.9)
					_m_grp.append(3)
					_m_flank.append(true)
				elif typ == 1:
					Kit.box("steel", Vector3(0.96, 0.1, 0.1), Vector3(x, y, fz + 0.05), Basis.IDENTITY, 1.0, 0.4)
					for k in 7:
						var ci := Kit.px(Vector3(x - 0.42 + 0.14 * float(k), y, fz + 0.108), 0.12, 0.07)
						_p_idx.append(ci)
						_p_ph.append(float(k) * 0.55 + float(i))
						_p_kind.append(5)
						_p_grp.append(3)
				elif typ == 2:
					Kit.box("steel", Vector3(0.98, 0.22, 0.16), Vector3(x, y, fz + 0.08), Basis.IDENTITY, 1.0, 0.4)
					var u3 := _su_pos.size()
					_su_pos.append(Vector3(x, y, fz + 0.2))
					_su_grp.append(3)
					for k in 4:
						_s_idx.append(Kit.px(Vector3(x - 0.36 + 0.24 * float(k), y, fz + 0.165), 0.2, 0.16))
						_s_unit.append(u3)
				else:
					Kit.box("steel", Vector3(0.8, 0.34, 0.18), Vector3(x, y, fz + 0.09), Basis.IDENTITY, 1.0, 0.4)
					var u4 := _bu_pos.size()
					_bu_pos.append(Vector3(x, y, fz + 0.2))
					_bu_grp.append(3)
					for cx in [-1.0, 1.0]:
						_b_idx.append(Kit.px(Vector3(x + cx * 0.19, y, fz + 0.185), 0.3, 0.28))
						_b_unit.append(u4)
		for yy in [1.9, 3.35, 4.8, 6.25, 7.7]:
			Kit.bar(Vector3(sx * 6.45, yy, FLANK_Z), Vector3(sx * 5.4, yy, FLANK_Z), 0.05)
	# ---- front towers, line arrays, subs, wedges
	for sx in [-1.0, 1.0]:
		var tx: float = sx * 6.3
		var tz := -107.6
		Kit.truss(Vector3(tx, dh, tz), Vector3(tx, 8.55, tz), 0.25, 0.25, 0.5)
		Kit.truss(Vector3(tx, 8.3, tz), Vector3(tx, 8.3, ROW_Z[0]), 0.2, 0.2, 0.5)
		Kit.box("steel", Vector3(0.8, 0.1, 0.8), Vector3(tx, dh + 0.05, tz), Basis.IDENTITY, 1.0, 0.5)
		for k in 22:
			var i := Kit.px(Vector3(tx - sx * 0.0, 1.7 + 0.31 * float(k), tz + 0.27), 0.1, 0.22)
			_p_idx.append(i)
			_p_ph.append(float(k) * 0.4)
			_p_kind.append(0)
			_p_grp.append(1)
		# line array: bumper and nine cabinets, splayed
		var ax: float = sx * 5.35
		Kit.box("steel", Vector3(0.9, 0.12, 0.6), Vector3(ax, 8.1, tz), Basis.IDENTITY, 1.0, 0.4)
		Kit.bar(Vector3(ax - 0.3, 8.16, tz), Vector3(tx, 8.4, tz), 0.05)
		for k in 9:
			var yk := 7.85 - 0.375 * float(k)
			var rot := Basis(Vector3.RIGHT, 0.035 * float(k) + 0.02)
			Kit.box("rubber", Vector3(0.86, 0.34, 0.55), Vector3(ax, yk, tz + 0.05), rot, 0.9, 0.7, 0.0)
			Kit.box("steel", Vector3(0.78, 0.26, 0.03), Vector3(ax, yk, tz + 0.34 + 0.012 * float(k)), rot, 0.7, 0.9, 0.2)
		# sub stacks
		for k in 3:
			Kit.box("rubber", Vector3(1.2, 0.75, 0.85), Vector3(sx * 5.1, dh + 0.375 + 0.75 * float(k), -106.2), Basis.IDENTITY, 1.0, 0.7, 0.0)
			Kit.box("steel", Vector3(1.0, 0.55, 0.03), Vector3(sx * 5.1, dh + 0.375 + 0.75 * float(k), -105.76), Basis.IDENTITY, 0.6, 0.9, 0.2)
		# flight cases and a wedge pair
		Kit.box("rubber", Vector3(1.0, 0.8, 0.7), Vector3(sx * 6.2, dh + 0.4, -119.3), Basis.IDENTITY, 0.9, 0.6, 0.0)
		Kit.box("rubber", Vector3(0.8, 0.6, 0.7), Vector3(sx * 5.9, dh + 1.1, -119.3), Basis.IDENTITY, 0.9, 0.6, 0.0)
		for wx in [2.2, 3.9]:
			Kit.box("rubber", Vector3(0.9, 0.42, 0.55), Vector3(sx * wx, dh + 0.22, -104.9), Basis(Vector3.RIGHT, 0.42), 1.0, 0.6, 0.0)
	# ---- lighting arch over the steps: box truss with a pixel strip down the face
	var n_arch := 24
	for k in n_arch:
		var a1 := PI * float(k) / float(n_arch)
		var a2 := PI * float(k + 1) / float(n_arch)
		var p1 := ARCH_C + Vector3(ARCH_R * cos(a1), ARCH_R * sin(a1), 0)
		var p2 := ARCH_C + Vector3(ARCH_R * cos(a2), ARCH_R * sin(a2), 0)
		Kit.truss(p1, p2, 0.2, 0.2, 0.5)
		var am := (p1 + p2) * 0.5
		var tang := (p2 - p1).normalized()
		var roll := atan2(tang.y, tang.x)
		var i := Kit.px(am + Vector3(0, 0, 0.215), (p2 - p1).length() * 0.8, 0.09, Vector3(0, 0, 1), roll)
		_p_idx.append(i)
		_p_ph.append(float(k) * 0.55)
		_p_kind.append(1)
		_p_grp.append(0)
	for sx in [-1.0, 1.0]:
		Kit.truss(Vector3(sx * ARCH_R, 0.05, ARCH_C.z), Vector3(sx * ARCH_R, ARCH_C.y, ARCH_C.z), 0.2, 0.2, 0.5)
		Kit.box("steel", Vector3(0.9, 0.1, 0.9), Vector3(sx * ARCH_R, 0.05, ARCH_C.z), Basis.IDENTITY, 1.0, 0.5)
		for k in 5:
			_p_idx.append(Kit.px(Vector3(sx * ARCH_R, 0.35 + 0.42 * float(k), ARCH_C.z + 0.215), 0.09, 0.34))
			_p_ph.append(float(k) * 0.55 + 3.0)
			_p_kind.append(1)
			_p_grp.append(0)
	# ---- DJ riser and booth
	var rz := -116.0
	Kit.box("rubber", Vector3(6.4, 0.9, 3.2), Vector3(0, dh + 0.45, rz), Basis.IDENTITY, 0.8, 0.8, 0.0)
	Kit.box("rubber", Vector3(6.5, 0.06, 3.3), Vector3(0, dh + 0.91, rz), Basis.IDENTITY, 1.1, 0.3, 0.0)
	for j in 2:
		Kit.box("rubber", Vector3(2.4, 0.3 * float(j + 1), 0.4), Vector3(0, dh + 0.15 * float(j + 1), rz + 1.8 + 0.4 * float(1 - j)), Basis.IDENTITY, 0.9, 0.7, 0.0)
	var top := dh + 0.94
	Kit.box("rubber", Vector3(4.6, 0.83, 0.9), Vector3(0, top + 0.415, rz + 0.35), Basis.IDENTITY, 0.7, 0.6, 0.0)
	Kit.box("steel", Vector3(4.8, 0.07, 1.1), Vector3(0, top + 0.87, rz + 0.35), Basis.IDENTITY, 1.0, 0.3)
	_booth_mat = Kit.screen_mat("booth", Vector2(64.0, 12.0))
	var bq := QuadMesh.new()
	bq.size = Vector2(4.2, 0.62)
	Architecture.mi(root, bq, _booth_mat, Vector3(0, top + 0.41, rz + 0.35 + 0.451))
	for sx in [-1.0, 1.0]:
		Kit.box("steel", Vector3(0.44, 0.1, 0.52), Vector3(sx * 0.62, top + 0.96, rz + 0.35), Basis.IDENTITY, 1.0, 0.4)
		for k in 6:
			var ang := float(k) * TAU / 6.0
			var i := Kit.px(Vector3(sx * 0.62 + cos(ang) * 0.14, top + 1.015, rz + 0.35 + sin(ang) * 0.14), 0.05, 0.05, Vector3(0, 1, 0))
			_p_idx.append(i)
			_p_ph.append(ang * 1.0 + (0.0 if sx < 0.0 else 2.0))
			_p_kind.append(4)
			_p_grp.append(0)
	Kit.box("steel", Vector3(0.36, 0.1, 0.46), Vector3(0, top + 0.96, rz + 0.35), Basis.IDENTITY, 1.0, 0.4)
	for k in 8:
		_p_idx.append(Kit.px(Vector3(-0.12 + 0.034 * float(k), top + 1.015, rz + 0.5), 0.025, 0.06, Vector3(0, 1, 0)))
		_p_ph.append(float(k) * 0.7)
		_p_kind.append(0)
		_p_grp.append(0)
	Dj.build(root, top, rz)
	Sign.build(root)
	# ---- the mirror ball
	Ball.build(root, _mobile)
	Kit.flush(root)


## Stage show for this frame.
static func update(clock: Clock, focus: Dictionary) -> void:
	var beat := clock.beat
	var bar := clock.bar
	var e := clock.e
	var kp := clock.kp
	var black := clock.black
	var ramp := clock.build
	var is_drop := clock.is_drop
	var sec := clock.sec_name
	var mode := 2.0
	if is_drop:
		mode = 4.0
	elif sec == "break":
		mode = 3.0 if ramp > 0.0 else 0.0
	elif sec == "intro" or sec == "outro":
		mode = 1.0
	# how awake the rig is: asleep early in the break, then waking through the build
	var wake: float
	if is_drop:
		wake = 1.0
	elif sec == "break":
		wake = 0.08 + 0.92 * smoothstep(0.0, 1.0, ramp)
	else:
		wake = clampf(0.3 + 0.75 * e, 0.0, 1.0)
	wake *= black
	var lvl := wake * (0.4 + 0.6 * e)
	var gw: Array[float] = [smoothstep(0.0, 0.12, wake), smoothstep(0.2, 0.42, wake), smoothstep(0.42, 0.66, wake), smoothstep(0.62, 0.88, wake)]
	var shd := {"beat": beat, "bar": bar, "energy": e, "kick": kp, "down": clock.down, "build": ramp, "mode": mode, "blk": black}
	Kit.set_screen_params(shd)
	Kit.set_rig(lvl * (0.7 + 0.3 * kp))
	var deck_m := Kit.deck_mat()
	deck_m.set_shader_parameter("refl", 0.55 if _mobile else 1.0)
	_screen_mat.set_shader_parameter("gain", 1.0)
	# mirror ball: the shader mirrors the screen, so it gets the same clock values
	var ball_lvl := clampf((0.12 + 0.88 * lvl) * (0.4 + 0.6 * black), 0.0, 1.0)
	Ball.update(clock, ball_lvl, shd, _mobile)
	var bc := Ball.center
	var cam_pos: Vector3 = focus["cam_pos"]
	# strobe level (accelerating through the build, walls on the drop)
	var sb := 0.0
	var pat := 0
	var gate := fposmod(beat * 4.0, 1.0) < 0.45
	if is_drop:
		var bar8 := int(floor(bar)) % 8
		pat = int(floor(beat * 2.0))
		if bar8 == 7:
			sb = 1.0 if gate else 0.0
		elif bar8 % 2 == 1 and fposmod(bar, 1.0) > 0.75:
			sb = 1.0 if gate else 0.0
		else:
			sb = clock.down * 0.9
	elif ramp > 0.15:
		var phase := 16.0 * ramp + 64.0 * ramp * ramp * ramp
		sb = (0.35 + 0.65 * ramp) if fposmod(phase, 1.0) < 0.3 else 0.0
		sb *= black
	elif e > 0.5:
		sb = kp * 0.08
	# beams shorten as the camera nears the stage, so they never wrap around it; down the hall they run long
	var z_end := lerpf(-102.0, 0.0, smoothstep(-100.0, -70.0, cam_pos.z))
	# ---- movers
	var n_m := _m_pos.size()
	for i in n_m:
		var o := _m_pos[i]
		var row := _m_row[i]
		var u := _m_u[i]
		var col := i % 7
		var gww: float = gw[_m_grp[i]]
		var yaw: float
		var pitch: float
		var bar_i := int(floor(bar))
		if is_drop:
			match bar_i % 4:
				0:
					yaw = u * (0.2 + 0.6 * (0.5 + 0.5 * sin(beat * PI * 0.5)))
					pitch = -0.04 + 0.1 * float(row) + 0.08 * sin(beat * PI)
				1:
					var ph2 := beat * 2.0 - float(i) * 0.5
					yaw = sin(ph2 * 0.5) * 0.6
					pitch = -0.08 + 0.25 * absf(sin(ph2 * 0.5 + float(row)))
				2:
					yaw = -u * 0.7 * sin(beat * PI * 0.5)
					pitch = 0.04 * float(row) - 0.06 + 0.12 * sin(beat * PI + float(i))
				_:
					var st := floorf(beat * 2.0)
					var f := smoothstep(0.0, 0.35, fposmod(beat * 2.0, 1.0))
					var ya := (Fixtures.hash01(st + float(i) * 3.1) * 2.0 - 1.0) * 0.8
					var yb := (Fixtures.hash01(st - 1.0 + float(i) * 3.1) * 2.0 - 1.0) * 0.8
					var pa := (Fixtures.hash01(st * 1.3 + float(i) * 5.7) * 2.0 - 0.6) * 0.3
					var pb := (Fixtures.hash01((st - 1.0) * 1.3 + float(i) * 5.7) * 2.0 - 0.6) * 0.3
					yaw = lerpf(yb, ya, f)
					pitch = lerpf(pb, pa, f)
			if bar_i % 8 == 7:
				yaw = u * 0.15
				pitch = -0.02 + 0.05 * float(row)
		elif ramp > 0.01:
			yaw = u * 0.6 * (1.0 - ramp) + 0.2 * sin(beat * (1.0 + 6.0 * ramp) * PI * 0.5 + float(i))
			pitch = 0.0 + 0.2 * ramp * float(row) - 0.05
		elif e > 0.5:
			yaw = u * 0.35 + 0.2 * sin(beat * TAU / 8.0 + float(i) * 0.5)
			pitch = -0.02 + 0.1 * sin(beat * TAU / 16.0 + float(row))
		else:
			yaw = u * 0.25 + 0.25 * sin(beat * TAU / 32.0 + float(col) * 0.4)
			pitch = 0.05 + 0.12 * sin(beat * TAU / 32.0 + float(row) * 1.3)
		if _m_flank[i]:
			yaw *= 0.8
		var d := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch))
		var colr := Fixtures.rainbow(float(i) * 0.17 + beat / 16.0)
		var lv := lvl * gww * (0.75 + 0.5 * kp)
		Fixtures.head(o, d)
		if lv < 0.02:
			continue
		if not (_mobile and _m_flank[i]):
			var l := Layout.clip_len(o, d, 38.0)
			if d.z > 0.01:
				l = minf(l, (z_end - o.z) / d.z)
			var r := l * (0.022 if i % 2 == 0 else 0.04)
			# half the old level (the cone shader is brighter now), and a beam aimed at the lens
			# fades out: seen end-on it is just a big flat translucent wedge
			var toward := d.dot((cam_pos - o).normalized())
			var aim := 1.0 - 0.9 * smoothstep(0.8, 0.97, toward)
			Fixtures.cone(o, d, l, r, colr * (lv * 0.3 * aim))
			if o.y + d.y * l < 0.4:
				Fixtures.glow_floor(o + d * l, r * 3.0, colr * (lv * 0.7))
		Fixtures.glow_bb(o + d * 0.3, 0.8 + 0.7 * lv, colr * lv)
	# ---- strobes, blinders, pixels
	var sbv := sb * black
	var pulse_idle := 0.12
	for k in _s_idx.size():
		var u2 := _s_unit[k]
		var g: float = gw[_su_grp[u2]]
		var on := 1.0 if (u2 + pat) % 3 != 0 else 0.35
		var cell := float(k % 6)
		var f2 := sbv * on * (0.75 + 0.25 * Fixtures.hash01(cell + float(u2) * 1.7)) * g
		var c := Color(1.0, 0.72, 0.66) * (f2 * 3.2) + Color(1.0, 0.05, 0.03) * (pulse_idle * lvl * g)
		Kit.px_set(_s_idx[k], c)
	for u3 in _su_pos.size():
		var g3: float = gw[_su_grp[u3]]
		var on3 := 1.0 if (u3 + pat) % 3 != 0 else 0.35
		Fixtures.glow_bb(_su_pos[u3] + Vector3(0, 0, 0.1), 1.3, Color(1.0, 0.65, 0.6) * (sbv * on3 * g3))
	var blv := sbv if is_drop else sbv * 0.6
	for k in _b_idx.size():
		var g4: float = gw[_bu_grp[_b_unit[k]]]
		var cb := Color(1.0, 0.55, 0.45) * (blv * g4 * 3.0) + Color(1.0, 0.1, 0.05) * (0.1 * lvl * g4)
		Kit.px_set(_b_idx[k], cb)
	for u4 in _bu_pos.size():
		var g5: float = gw[_bu_grp[u4]]
		Fixtures.glow_bb(_bu_pos[u4] + Vector3(0, 0, 0.2), 3.0, Color(1.0, 0.4, 0.34) * (blv * g5 * 0.9))
	for k in _p_idx.size():
		var g6: float = gw[_p_grp[k]]
		var ph := _p_ph[k]
		var v := 0.0
		match _p_kind[k]:
			0:
				v = pow(0.5 + 0.5 * sin(beat * (TAU / 2.0 if is_drop else TAU / 8.0) - ph), 3.0)
				v = 0.12 + 0.88 * v
			1:
				v = pow(0.5 + 0.5 * sin(beat * (TAU / 4.0 if is_drop else TAU / 16.0) - ph), 4.0)
				v = 0.15 + 0.85 * v
			2:
				v = 0.15 + 0.5 * kp + 0.6 * pow(0.5 + 0.5 * sin(beat * TAU / 4.0 - ph), 6.0)
			3:
				v = 0.15 + 0.85 * pow(0.5 + 0.5 * sin(beat * TAU / 2.0 - ph * 2.2), 4.0)
			4:
				v = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(beat * TAU / 4.0 - ph), 2.0)
			_:
				v = pow(0.5 + 0.5 * sin(beat * (TAU if is_drop else TAU / 4.0) - ph), 4.0)
				v = 0.1 + 0.9 * v
		v = v * (0.25 + 0.75 * e) * black * g6
		var shade := Fixtures.rainbow(ph * 0.1 + beat / 8.0)
		var pc := shade * (v * 2.0)
		if v > 0.85:
			pc += Color(0.6, 0.3, 0.25) * ((v - 0.85) * 4.0)
		Kit.px_set(_p_idx[k], pc)
	Kit.px_flush()
	# ---- booth, deck wash, screen halo
	_booth_mat.set_shader_parameter("gain", 1.0)
	var glow := RED
	Fixtures.glow_floor(Vector3(0, Layout.DECK_H, -112.0), 14.0, glow * (lvl * 0.3))
	Fixtures.glow_floor(Vector3(0, Layout.DECK_H, -119.0), 12.0, glow * (lvl * 0.45 * (0.6 + 0.4 * clock.down)))
	Fixtures.glow_bb(Vector3(0, Layout.DECK_H + 1.9, -114.3), 3.5, glow * (0.12 * lvl + 0.1 * kp * lvl))
	Fixtures.glow_bb(Vector3(0, SCR_C.y, SCR_C.z + 1.5), 20.0, glow * (0.14 * lvl * (0.6 + 0.4 * e)))
	Fixtures.glow_floor(Vector3(0, 0.9, -103.0), 9.0, glow * (lvl * 0.2))
	Fixtures.glow_wall(Vector3(6.97, 4.5, -113.0), 1.0, 16.0, 8.0, glow * (lvl * 0.28))
	Fixtures.glow_wall(Vector3(-6.97, 4.5, -113.0), -1.0, 16.0, 8.0, glow * (lvl * 0.28))
	Dj.update(clock)
	Sign.update(clock, lvl)
	_lasers(clock, gw[2], z_end)


## Stage lasers fan out down the hall on the drop.
static func _lasers(clock: Clock, g: float, z_end: float) -> void:
	if not clock.is_drop or g < 0.1:
		return
	var beat := clock.beat
	var nl := 7 if _mobile else 9
	for sx in [-5.4, 0.0, 5.4]:
		var o2 := Vector3(sx, ARCH_C.y + sqrt(maxf(ARCH_R * ARCH_R - sx * sx, 0.0)) - 0.4, ARCH_C.z - 0.3)
		for k in nl:
			var yaw2 := (float(k) - float(nl - 1) * 0.5) * 0.1 * (0.5 + 0.5 * sin(beat * PI * 0.5)) + sin(beat * TAU / 8.0 + sx) * 0.3
			var pitch2 := -0.08 + 0.08 * sin(beat * TAU / 4.0 + float(k))
			var d2 := Vector3(sin(yaw2) * cos(pitch2), sin(pitch2), cos(yaw2) * cos(pitch2))
			var ll := Layout.clip_len(o2, d2, 50.0)
			if d2.z > 0.01:
				ll = minf(ll, (z_end - o2.z) / d2.z)
			Fixtures.stick(o2, d2, ll, 0.05, Fixtures.rainbow(float(k) / 9.0 + beat / 32.0) * 0.95)

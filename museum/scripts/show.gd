extends RefCounted
## Show: the light show for the bays. Maps the song clock to fixture states: per bay two moving
## heads, four wall-washing pars, the beams that land on each picture, blinders, and the frame
## washes; the hall's cross-bay lasers; and the focused-bay behaviour (the party dims, warm
## white light comes up on the viewed bay, one real spot, fed to the surface shaders by lite.gd). Pure function of clock + focus.
## The stage and the marquee have their own show logic in stage.gd / signage.gd.

const Layout := preload("res://scripts/layout.gd")
const Clock := preload("res://scripts/clock.gd")
const Fixtures := preload("res://scripts/fixtures.gd")
const ExhibitsBuild := preload("res://scripts/exhibits_build.gd")
const Materials := preload("res://scripts/materials.gd")
const Lite := preload("res://scripts/lite.gd")

const WARM := Color(1.0, 0.86, 0.62)

static var _pal: Array = []
static var _focus_w := PackedFloat32Array()


static func build(root: Node3D, exhibits: Array) -> void:
	_pal.clear()
	_focus_w = PackedFloat32Array()
	_focus_w.resize(exhibits.size())
	for _x in exhibits:
		# all fixtures are red: variety comes from shade, intensity, motion and width
		var vv := float(_pal.size() % 4) * 0.06
		_pal.append([Color.from_hsv(0.0, 0.92, 1.0 - vv), Color.from_hsv(0.985, 1.0, 0.62 + vv)])


## focus: {"bay": int (-1 none), "cam_basis": Basis, "cam_pos": Vector3}. Fixtures.begin() must
## have been called for this frame.
static func update(clock: Clock, focus: Dictionary) -> void:
	var fb: int = focus["bay"]
	# the haze scrolls with the song clock, so a captured frame is reproducible
	(Materials.get_mat("beam_cone") as ShaderMaterial).set_shader_parameter("t", clock.t)
	for b in _pal.size():
		_bay(clock, b, fb)
	_lasers(clock, fb)
	if fb >= 0:
		var side := Layout.bay_side(fb)
		var from := Vector3(side * 1.5, 8.0, Layout.bay_z(fb))
		var to := Vector3(side * 5.6, 1.0, Layout.bay_z(fb))
		var fe := smoothstep(0.0, 1.0, _focus_w[fb])
		Lite.spot(from, (to - from).normalized(), WARM, 2.4 * fe)
	else:
		Lite.spot(Vector3.ZERO, Vector3.DOWN, WARM, 0.0)


static func _mover_target(clock: Clock, b: int, k: int, z: float, sx: float) -> Vector3:
	var beat := clock.beat
	var bar := clock.dbar
	var dx: float
	var dz: float
	if clock.is_drop:
		var fig := int(floor(bar)) % 4
		match fig:
			0:
				var a := sin(beat * TAU / 4.0)
				dx = sx * (1.5 + 4.5 * (0.5 + 0.5 * a))
				dz = 6.0 * a * sx
			1:
				var a2 := beat * PI
				dx = 4.5 * cos(a2)
				dz = 6.0 * sin(a2) * sx
			2:
				dx = sx * 5.0 * sin(beat * PI)
				dz = 5.0 * sin(beat * TAU / 4.0 + float(k) * PI)
			_:
				var st := beat * 2.0
				var i0 := floorf(st)
				var ease_t := smoothstep(0.0, 0.3, st - i0)
				var ax := (Fixtures.hash01(i0 + float(k) * 7.0 + float(b)) * 2.0 - 1.0) * 6.0
				var az := (Fixtures.hash01(i0 + float(k) * 3.0 + float(b) * 5.0 + 91.0) * 2.0 - 1.0) * 6.0
				var bx := (Fixtures.hash01(i0 - 1.0 + float(k) * 7.0 + float(b)) * 2.0 - 1.0) * 6.0
				var bz := (Fixtures.hash01(i0 - 1.0 + float(k) * 3.0 + float(b) * 5.0 + 91.0) * 2.0 - 1.0) * 6.0
				dx = lerpf(bx, ax, ease_t)
				dz = lerpf(bz, az, ease_t)
	elif clock.e > 0.5:
		dx = sx * (2.5 + 3.0 * sin(beat * TAU / 8.0 + float(b) * 0.4))
		dz = 5.0 * sin(beat * TAU / 16.0 + float(k) * PI)
	else:
		var ph := beat * TAU / 32.0
		dx = sx * (3.5 + 2.5 * sin(ph + float(b) * 0.7))
		dz = 4.0 * sin(ph * 0.5 + float(k) * PI)
	return Vector3(clampf(dx, -6.3, 6.3), 0.0, z + dz)


static func _par_level(clock: Clock, b: int, k: int) -> float:
	var beat := clock.beat
	var v: float
	if clock.is_drop:
		var st := beat * 2.0
		var on := (int(floor(st)) + b + k) % 4 == 0
		v = (0.9 * exp(-fposmod(st, 1.0) * 2.5) if on else 0.0) + 0.3 + 0.2 * clock.kp
	elif clock.e > 0.5:
		var on2 := (int(floor(beat)) + k) % 4 == 0
		v = (0.55 * exp(-fposmod(beat, 1.0) * 3.0) if on2 else 0.0) + 0.18 + 0.2 * clock.kp
	else:
		v = 0.22 + 0.16 * sin(beat * TAU / 16.0 + float(b) * 0.6 + float(k) * 1.2)
	return v + clock.build * 0.4 * clock.kp


static func _bay(clock: Clock, b: int, focus_bay: int) -> void:
	var beat := clock.beat
	var bar := clock.dbar
	var e := clock.e
	var kp := clock.kp
	var black := clock.black
	var side := Layout.bay_side(b)
	var z := Layout.bay_z(b)
	_focus_w[b] = lerpf(_focus_w[b], 1.0 if b == focus_bay else 0.0, 1.0 - exp(-clock.dt * 3.0))
	var fw: float = _focus_w[b]
	var cA: Color = _pal[b][0]
	var cB: Color = _pal[b][1]
	var fe := smoothstep(0.0, 1.0, fw)   # eased focus: red party -> warm white, a smooth tween
	var party := (1.0 - fw * 0.85) * black
	var alt := (int(floor(beat / 2.0)) % 2) if clock.is_drop else 0
	# beam width breathes with the section: wide and soft in a break, tight and hard in a drop
	var wd := lerpf(1.45, 0.72, clampf(e, 0.0, 1.0))
	# moving heads
	for k in 2:
		var sx := 1.0 if k == 0 else -1.0
		var o := Vector3(sx * 3.6, Layout.TRUSS_Y - 0.1, z)
		var tp := _mover_target(clock, b, k, z, sx)
		# focused: the beams drop to a soft pool on the floor in front of the picture
		tp = tp.lerp(Vector3(side * 5.0, 0.0, z + sx * 3.4), fe)
		var col: Color = (cA if (k + alt) % 2 == 0 else cB).lerp(WARM, fe)
		var lvl := (0.3 + 0.5 * e) * (0.7 + 0.5 * kp * e) * black
		lvl = lerpf(lvl, 0.26, fe)
		var d := tp - o
		var dist := d.length()
		d /= dist
		var r := dist * (0.06 if k == 0 else 0.12) * wd
		Fixtures.cone(o, d, dist, r, col * (lvl * 0.55))
		Fixtures.cone(o, d, dist, r * 2.4, col * (lvl * 0.13))
		Fixtures.glow_floor(tp, r * 3.0, col * (lvl * 0.7))
		Fixtures.glow_floor(tp, r * 1.0, col * (lvl * 2.4))   # the hot spot where it lands
		Fixtures.head(o, d, col * (lvl * 3.0))
		Fixtures.glow_bb(o + d * 0.34, 0.85, col * (lvl * 3.2))
	# pars: uplights washing the walls, chasing on beats
	for k in 4:
		var sx := 1.0 if k % 2 == 0 else -1.0
		var sz := 1.0 if k < 2 else -1.0
		var v := _par_level(clock, b, k)
		var col2: Color = cA if k % 2 == 0 else cB
		v *= party
		Fixtures.wash_up(Vector3(sx * 6.97, 0.3, z + sz * 2.6), sx, 5.0, 7.6, col2 * (v * 1.1))
		Fixtures.glow_bb(Vector3(sx * 6.48, 0.52, z + sz * 2.6), 0.55, col2 * (v * 1.3))
	# fixtures aimed at the frames: red beams landing on the art, warm white when focused
	for ai in Fixtures.art_lights(b):
		var src := Fixtures.art_src(ai)
		var tg := Fixtures.art_tgt(ai)
		var dv := tg - src
		var al := dv.length()
		dv /= al
		var acol: Color = cA.lerp(WARM, fe)
		var alv := ((1.0 + 0.5 * kp * e) * (0.5 + 0.5 * black)) * (1.0 - fe) + 0.45 * fe
		Fixtures.cone(src, dv, al, al * 0.075, acol * (alv * 1.0))
		Fixtures.cone(src, dv, al, al * 0.17, acol * (alv * 0.3))
		Fixtures.head(src - dv * 0.23, dv, acol * (alv * 3.0), 0.8)
		Fixtures.glow_bb(src + dv * 0.04, 0.55, acol * (alv * 3.2))
	for fr in ExhibitsBuild.frames(b):
		var fp: Vector3 = fr[0]
		var fs: Vector2 = fr[1]
		# the soft red falloff on the frame and the wall around it; the picture stays in front of it
		var wl := cA.lerp(WARM, fe * 0.7) * ((0.65 + 0.25 * kp * e) * (0.4 + 0.6 * black))
		# 5 cm behind the picture plane (6.92): coplanar with the art it z-fought into stripes
		Fixtures.glow_wall(Vector3(side * 6.96, fp.y, fp.z), side, fs.x + 3.2, fs.y + 3.2, wl)
		Fixtures.glow_floor(Vector3(side * 6.1, 0.0, fp.z), fs.x * 0.9, wl * 0.5)
	# a standing wash over the whole bay (walls, mouldings and frames read along the hall even in a
	# blackout), thinning when the bay is focused (the warm light takes over)
	Fixtures.glow_wall(Vector3(side * 6.965, 3.6, z), side, 9.0, 7.6, cA * ((0.2 + 0.1 * kp * e) * (0.55 + 0.45 * black) * (1.0 - 0.6 * fe)))
	if fe > 0.01:
		Fixtures.glow_wall(Vector3(side * 6.97, 2.9, z), side, 13.0, 6.0, WARM * (0.16 * fe))
		Fixtures.glow_floor(Vector3(side * 4.2, 0, z), 7.0, WARM * (0.1 * fe))
	# blinders and strobes
	var bl := 0.0
	if clock.is_drop:
		bl = clock.down
		if int(floor(bar)) % 8 == 7:
			bl = 1.0 if fposmod(beat * 4.0, 1.0) < 0.35 else 0.0
	elif clock.build > 0.3:
		var rate := 2.0 + clock.build * 6.0
		bl = clock.build * 0.7 if fposmod(beat * rate, 1.0) < 0.3 else 0.0
	elif e > 0.5:
		bl = kp * 0.12
	bl *= (1.0 - fw * 0.9)
	# blinders: a white-hot core in a red halo (the flare sprite), which also flashes the room
	var bc := cA.lerp(Color.WHITE, 0.3)
	Fixtures.glow_bb(Vector3(-5.8, 7.05, z), 2.6 + 2.2 * bl, bc * (bl * 2.4))
	Fixtures.glow_bb(Vector3(5.8, 7.05, z), 2.6 + 2.2 * bl, cB.lerp(Color.WHITE, 0.3) * (bl * 2.4))
	# art brightness follows the room lightly, never past the texture
	var g := 0.95 + 0.04 * kp * e
	ExhibitsBuild.set_art_level(b, g)


## Cross-hall lasers from the truss on the drop; skipped near the focused bay.
static func _lasers(clock: Clock, focus_bay: int) -> void:
	if not clock.is_drop:
		return
	var beat := clock.beat
	var bar := clock.dbar
	var n := 7
	for bi in range(0, _pal.size(), 3):
		if focus_bay >= 0 and absi(bi - focus_bay) <= 1:
			continue
		var o := Vector3(0, Layout.TRUSS_Y - 0.2, Layout.bay_z(bi))
		var zd := -1.0 if int(bi / 3.0) % 2 == 0 else 1.0
		var col := Color(1.0, 0.08, 0.06) if (int(floor(bar)) + bi) % 2 == 0 else Color(0.8, 0.02, 0.1)
		var sweep := sin(beat * TAU / 8.0) * 0.35
		Fixtures.head(o + Vector3(0, -0.1, 0), Vector3(0, -0.15, zd).normalized(), col * 0.6, 0.55)
		for k in n:
			var yaw := (float(k) - 3.0) * 0.14 * (0.6 + 0.4 * sin(beat * PI * 0.5)) + sweep
			var pitch := -0.12 + 0.1 * sin(beat * TAU / 4.0 + float(k) * 0.7)
			var d := Vector3(sin(yaw) * cos(pitch), sin(pitch), zd * cos(yaw) * cos(pitch))
			Fixtures.stick(o, d, Layout.clip_len(o, d, 24.0), 0.03, col * 1.3)

extends RefCounted
## Stage DJ: a procedural, beat-synced dancer rigged in code as a small skeleton (pelvis, spine,
## neck/head, upper + lower arms, thighs + shins, feet) drawn as ~22 boxes in one MultiMesh plus a
## sphere head, in the stage's rubber material (dark clothes, red rim from the screen behind).
## A "move" is a function of the beat that fills a parameter vector (hips, spine, head, hand and
## foot targets); arms and legs are solved with two-bone IK. The move is picked per 2-bar unit from
## a list per song section (the song's cue sheet), held 2 or 4 bars, and eased in over 1.5 beats from the move
## before it, so there are no pops. Section overrides: both hands up on the last bar of the break
## and on drop phrase starts, a jump on the drop.
## Everything is a pure function of song time (clock.beat/bar), like the rest of the show.
## Coordinates are relative to O = (0, riser top, booth z); the DJ faces +z (the crowd).

const Architecture := preload("res://scripts/architecture.gd")
const Fixtures := preload("res://scripts/fixtures.gd")
const Clock := preload("res://scripts/clock.gd")
const Kit := preload("res://scripts/stage_kit.gd")

# parameter vector layout
const HX := 0
const HY := 1
const HZ := 2
const HYAW := 3
const HROLL := 4
const SP := 5      # spine pitch (+ leans forward)
const SR := 6
const SYAW := 7
const HDP := 8     # head pitch (+ nods down)
const HDR := 9
const HDY := 10
const LH := 11     # left hand target xyz (viewer's left, -x)
const RH := 14
const ELB := 17    # elbow out
const LF := 18     # left foot xyz (offset x, lift y, offset z)
const RF := 21
const NP := 24

# moves
const G_TWO := 0
const G_SIDE := 1
const G_FADER := 2
const G_BOUNCE := 3
const G_POINT := 4
const I_NOD := 5
const I_MIX := 6
const I_LEAN := 7
const B_ARM := 8
const B_BOTH := 9
const D_PUMP := 10
const D_ALT := 11
const D_UP := 12
const D_WIDE := 13
const M_UP := 14
const LISTS := {
	"groove": [0, 1, 2, 3, 4],
	"intro": [5, 6, 7],
	"outro": [5, 6, 7],
	"break": [8, 9],
	"drop": [10, 11, 12, 13],
}

const BODY_Z := -0.1
const HIP_H := 0.9
const UARM := 0.36
const FARM := 0.34
const THIGH := 0.47
const SHIN := 0.47
const N_INST := 22
const REST_Y := 1.04
const EAR := Vector3(0.18, 1.70, 0.0)

static var _mm: MultiMesh
static var _head: MeshInstance3D
static var _org := Vector3.ZERO
static var _secs: Array = []
static var _nbars: int = 64
# last solved joints, for tests: pelvis, chest, head, L/R shoulder, elbow, hand, L/R knee, foot
static var joints: PackedVector3Array = PackedVector3Array()


static func build(root: Node3D, top: float, rz: float) -> void:
	_org = Vector3(0.0, top, rz)
	_mm = MultiMesh.new()
	_mm.transform_format = MultiMesh.TRANSFORM_3D
	_mm.use_colors = true
	_mm.mesh = Architecture.box(Vector3.ONE)
	_mm.instance_count = N_INST
	# colours (albedo scale, roughness scale, metal): clothes, skin, cap, glossy headphones
	var cloth := Color(0.3, 0.8, 0.0)
	var skin := Color(0.55, 0.7, 0.0)
	var cap := Color(0.22, 0.8, 0.0)
	var phone := Color(0.14, 0.2, 0.3)
	var cols := [cloth, cloth, skin, cloth, cloth, cloth, cloth, skin, skin, Color(0.22, 0.8, 0.0), Color(0.22, 0.8, 0.0), Color(0.22, 0.8, 0.0), Color(0.22, 0.8, 0.0), Color(0.12, 0.3, 0.2), Color(0.12, 0.3, 0.2), cap, cap, phone, phone, phone, cloth, cloth]
	for i in N_INST:
		_mm.set_instance_color(i, cols[i])
		_mm.set_instance_transform(i, Transform3D(Basis.from_scale(Vector3.ONE * 0.001), _org))
	var inst := MultiMeshInstance3D.new()
	inst.multimesh = _mm
	inst.material_override = Kit.solid("rubber")
	inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	inst.custom_aabb = AABB(Vector3(-3, 0, -120), Vector3(6, 8, 8))
	root.add_child(inst)
	var hs := SphereMesh.new()
	hs.radius = 0.115
	hs.height = 0.25
	hs.radial_segments = 12
	hs.rings = 6
	_head = Architecture.mi(root, hs, Kit.solid("rubber"), _org)
	joints.resize(16)


# ------------------------------------------------------------------ move selection

static func _sec_idx(bw: float) -> int:
	for i in _secs.size():
		var s: Dictionary = _secs[i]
		if bw >= float(s["from"]) and bw < float(s["to"]):
			return i
	return -1


static func _sec_at(bw: float) -> Dictionary:
	var i := _sec_idx(bw)
	return _secs[i] if i >= 0 else {"name": "intro", "from": 0, "to": _nbars}


static func _name_at(i: int) -> String:
	return str(_secs[posmod(i, _secs.size())]["name"]) if not _secs.is_empty() else ""


static func _raw(u: int) -> int:
	var nu := _nbars / 2
	u = posmod(u, nu)
	var s := _sec_at(float(u * 2))
	var list: Array = LISTS.get(str(s["name"]), LISTS["groove"])
	var n := list.size()
	return list[int(Fixtures.hash01(float(u) * 1.7 + 3.1) * float(n)) % n]


static func _id(u: int) -> int:
	var nu := _nbars / 2
	u = posmod(u, nu)
	var r := _raw(u)
	if r == _raw(u - 1):
		var s := _sec_at(float(u * 2))
		var list: Array = LISTS.get(str(s["name"]), LISTS["groove"])
		r = list[(list.find(r) + 1) % list.size()]
	return r


# ------------------------------------------------------------------ moves

static func _bnc(b: float) -> float:
	var c := 0.5 + 0.5 * cos(TAU * b)
	return c * c


static func _base() -> PackedFloat32Array:
	var p := PackedFloat32Array()
	p.resize(NP)
	p.fill(0.0)
	p[SP] = 0.2
	p[LH] = -0.5
	p[LH + 1] = REST_Y
	p[LH + 2] = 0.34
	p[RH] = 0.5
	p[RH + 1] = REST_Y
	p[RH + 2] = 0.34
	p[ELB] = 0.7
	return p


static func _hand(p: PackedFloat32Array, o: int, x: float, y: float, z: float) -> void:
	p[o] = x
	p[o + 1] = y
	p[o + 2] = z


static func _knob(p: PackedFloat32Array, o: int, b: float, cx: float, cz: float, spd: float) -> void:
	var a := TAU * b * spd
	_hand(p, o, cx + 0.03 * cos(a), REST_Y + 0.004, cz + 0.03 * sin(a))


static func _move(id: int, b: float, build: float) -> PackedFloat32Array:
	var p := _base()
	var bn := _bnc(b)
	match id:
		G_TWO:
			var ph := fposmod(b, 2.0)
			var s := sin(PI * ph)
			p[HX] = 0.07 * s
			p[HROLL] = -0.05 * s
			p[HY] = -0.05 * bn
			p[SYAW] = 0.1 * s
			p[SP] = 0.22 + 0.04 * bn
			p[HDP] = 0.1 * bn
			p[HDR] = 0.05 * s
			p[LF + 1] = 0.11 * maxf(0.0, s)
			p[RF + 1] = 0.11 * maxf(0.0, -s)
			_knob(p, LH, b, -0.1, 0.28, 0.5)
			_hand(p, RH, EAR.x, EAR.y + 0.015 * bn, EAR.z)
			p[ELB] = 0.9
		G_SIDE:
			var sx := sin(TAU * b / 4.0)
			var vel := cos(TAU * b / 4.0)
			p[HX] = 0.16 * sx
			p[HY] = -0.05 * bn
			p[HROLL] = -0.05 * sx
			p[SR] = 0.06 * sx
			p[HDY] = 0.2 * sx
			p[HDP] = 0.12 * bn
			p[LF] = 0.16 * sx
			p[RF] = 0.16 * sx
			p[LF + 1] = 0.09 * maxf(0.0, -vel)
			p[RF + 1] = 0.09 * maxf(0.0, vel)
			p[SP] = 0.26
			var a := TAU * b * 0.5
			_hand(p, LH, -0.58 + 0.035 * cos(a), REST_Y, 0.34 + 0.035 * sin(a))
			_hand(p, RH, 0.5, REST_Y + 0.035 * maxf(0.0, sin(PI * b)), 0.34)
		G_FADER:
			p[HX] = 0.04 * sin(TAU * b / 8.0)
			p[HY] = -0.04 * bn
			p[HROLL] = 0.04 * sin(TAU * b / 8.0)
			p[SYAW] = 0.08 * sin(TAU * b / 8.0)
			p[SP] = 0.28
			p[HDP] = 0.1 * bn
			p[HDR] = 0.08 * sin(TAU * b / 4.0)
			p[LF + 1] = 0.04 * maxf(0.0, sin(PI * b))
			p[RF + 1] = 0.04 * maxf(0.0, -sin(PI * b))
			_knob(p, LH, b, -0.12, 0.26, 0.5)
			_hand(p, RH, 0.16 * sin(TAU * b / 8.0), REST_Y, 0.55)
		G_BOUNCE:
			p[HY] = -0.08 * bn
			p[SP] = 0.3 + 0.06 * bn
			p[HDP] = 0.22 * bn
			p[SR] = 0.08 * sin(PI * b)
			p[HROLL] = -0.04 * sin(PI * b)
			p[LF + 1] = 0.05 * maxf(0.0, sin(PI * b))
			p[RF + 1] = 0.05 * maxf(0.0, -sin(PI * b))
			_hand(p, LH, -0.58, REST_Y + 0.045 * maxf(0.0, sin(PI * b)), 0.34)
			_hand(p, RH, 0.58, REST_Y + 0.045 * maxf(0.0, -sin(PI * b)), 0.34)
		G_POINT:
			var ph2 := fposmod(b, 2.0)
			var s2 := sin(PI * ph2)
			p[HX] = 0.05 * s2
			p[HY] = -0.05 * bn
			p[HYAW] = -0.18
			p[SYAW] = -0.12
			p[SP] = 0.12
			p[HDP] = 0.08 * bn
			p[HDY] = -0.2
			p[LF + 1] = 0.07 * maxf(0.0, s2)
			p[RF + 1] = 0.07 * maxf(0.0, -s2)
			_knob(p, LH, b, -0.1, 0.28, 0.5)
			_hand(p, RH, 0.6, 1.55 + 0.07 * bn, 0.5)
			p[ELB] = 0.4
		I_NOD:
			var nd := 0.5 + 0.5 * cos(PI * b)
			p[HDP] = 0.13 * nd * nd
			p[HX] = 0.03 * sin(TAU * b / 8.0)
			p[HY] = -0.02 * bn
			p[SP] = 0.2
			p[HDR] = 0.04 * sin(TAU * b / 8.0)
			_knob(p, LH, b, -0.12, 0.27, 0.25)
			_hand(p, RH, 0.1 * sin(TAU * b / 16.0), REST_Y, 0.55)
		I_MIX:
			p[HX] = 0.04 * sin(TAU * b / 8.0)
			p[HY] = -0.025 * bn
			p[SP] = 0.12
			p[HDR] = 0.12
			p[HDP] = 0.05 + 0.05 * bn
			p[SYAW] = 0.06 * sin(TAU * b / 8.0)
			_hand(p, LH, -0.2 + 0.1 * sin(TAU * b / 8.0), REST_Y, 0.52)
			_hand(p, RH, EAR.x, EAR.y, EAR.z)
			p[ELB] = 0.9
		I_LEAN:
			p[SP] = 0.36 + 0.03 * sin(TAU * b / 8.0)
			p[HDP] = 0.22
			p[HY] = -0.03 - 0.02 * bn
			p[HZ] = 0.03
			var a2 := TAU * b * 0.25
			_hand(p, LH, -0.56 + 0.03 * cos(a2), REST_Y, 0.34 + 0.03 * sin(a2))
			_hand(p, RH, 0.56 + 0.03 * cos(a2 + 2.0), REST_Y, 0.34 + 0.03 * sin(a2 + 2.0))
		B_ARM:
			var sw := sin(TAU * b / 4.0)
			p[HX] = 0.1 * sin(TAU * b / 8.0)
			p[HROLL] = -0.06 * sin(TAU * b / 8.0)
			p[HY] = -(0.02 + 0.05 * build) * bn
			p[SP] = 0.08
			p[HDP] = -0.08 + 0.08 * bn
			p[LF + 1] = 0.03 * maxf(0.0, sin(PI * b))
			_knob(p, LH, b, -0.12, 0.26, 0.5 + 0.5 * build)
			_hand(p, RH, 0.5 + 0.1 * sw, 1.85 + 0.25 * build, 0.1)
			p[ELB] = 0.8
		B_BOTH:
			var sw2 := sin(TAU * b / 4.0)
			p[HX] = -0.08 * sin(TAU * b / 8.0)
			p[HY] = -(0.02 + 0.05 * build) * bn
			p[SP] = 0.1
			p[HDP] = -0.12 + 0.08 * bn
			p[HDR] = -0.06 * sw2
			_hand(p, LH, -0.5 + 0.1 * sw2, 1.9 + 0.25 * build, 0.12)
			_knob(p, RH, b, 0.12, 0.26, 0.5 + 0.5 * build)
			p[RF + 1] = 0.03 * maxf(0.0, -sin(PI * b))
			p[ELB] = 0.8
		D_PUMP:
			p[HY] = -0.07 * bn
			p[SP] = 0.2 + 0.05 * bn
			p[HDP] = 0.24 * bn
			p[HROLL] = 0.04 * sin(PI * b)
			p[LF + 1] = 0.06 * maxf(0.0, sin(PI * b))
			p[RF + 1] = 0.06 * maxf(0.0, -sin(PI * b))
			_hand(p, RH, 0.45, 1.5 + 0.55 * bn, 0.3 - 0.1 * bn)
			_knob(p, LH, b, -0.12, 0.27, 0.5)
			p[ELB] = 0.8
		D_ALT:
			var pr := 0.5 + 0.5 * cos(PI * b)
			var pl := 0.5 - 0.5 * cos(PI * b)
			pr *= pr
			pl *= pl
			p[HY] = -0.07 * bn
			p[SP] = 0.15
			p[HDP] = 0.2 * bn
			p[SYAW] = 0.18 * (pr - pl)
			p[HYAW] = 0.1 * (pr - pl)
			p[LF + 1] = 0.06 * maxf(0.0, sin(PI * b))
			p[RF + 1] = 0.06 * maxf(0.0, -sin(PI * b))
			_hand(p, RH, 0.42, 1.45 + 0.6 * pr, 0.3)
			_hand(p, LH, -0.42, 1.45 + 0.6 * pl, 0.3)
			p[ELB] = 0.8
		D_UP:
			var sw3 := sin(TAU * b / 4.0)
			p[HY] = -0.08 * bn
			p[SP] = 0.05
			p[HDP] = -0.05 + 0.2 * bn
			p[HROLL] = 0.05 * sw3
			p[LF + 1] = 0.05 * maxf(0.0, sin(PI * b))
			p[RF + 1] = 0.05 * maxf(0.0, -sin(PI * b))
			_hand(p, LH, -0.46 - 0.08 * sw3, 2.0 + 0.1 * bn, 0.15)
			_hand(p, RH, 0.46 - 0.08 * sw3, 2.0 + 0.1 * bn, 0.15)
			p[ELB] = 0.8
		D_WIDE:
			var sx2 := sin(TAU * b / 4.0)
			var vel2 := cos(TAU * b / 4.0)
			p[HX] = 0.13 * sx2
			p[HY] = -0.08 * bn
			p[HROLL] = -0.05 * sx2
			p[SP] = 0.18
			p[HDP] = 0.2 * bn
			p[LF] = -0.1 + 0.13 * sx2
			p[RF] = 0.1 + 0.13 * sx2
			p[LF + 1] = 0.07 * maxf(0.0, -vel2)
			p[RF + 1] = 0.07 * maxf(0.0, vel2)
			_hand(p, LH, -0.5, 1.4 + 0.55 * bn, 0.3)
			_hand(p, RH, 0.5, 1.4 + 0.55 * bn, 0.3)
			p[ELB] = 0.9
		_:  # M_UP: both hands overhead
			p[HY] = -0.07 * bn
			p[SP] = 0.03
			p[HDP] = -0.05 + 0.15 * bn
			p[LF + 1] = 0.04 * maxf(0.0, sin(PI * b))
			p[RF + 1] = 0.04 * maxf(0.0, -sin(PI * b))
			_hand(p, LH, -0.44, 2.05 + 0.06 * bn, 0.14)
			_hand(p, RH, 0.44, 2.05 + 0.06 * bn, 0.14)
			p[ELB] = 0.8
	return p


static func _blend(a: PackedFloat32Array, b: PackedFloat32Array, w: float) -> PackedFloat32Array:
	var o := PackedFloat32Array()
	o.resize(NP)
	for i in NP:
		o[i] = lerpf(a[i], b[i], w)
	return o


## The pose parameters for this clock state.
static func pose(clock: Clock) -> PackedFloat32Array:
	var beat := clock.beat
	var nbeats := float(_nbars * 4)
	var u := int(floor(beat / 8.0))
	var id := _id(u)
	var u0 := u
	var back := 0
	while back < 3 and _id(u0 - 1) == id:
		u0 -= 1
		back += 1
	var since := fposmod(beat - float(u0) * 8.0, nbeats)
	var p := _move(id, beat, clock.build)
	var w := smoothstep(0.0, 1.5, since)
	if w < 1.0:
		p = _blend(_move(_id(u0 - 1), beat, clock.build), p, w)
	# overrides
	var bw := fposmod(clock.bar, float(_nbars))
	var si := _sec_idx(bw)
	var s := _sec_at(bw)
	var up := 0.0
	var jump := 0.0
	if str(s["name"]) == "break":
		# both hands up for the last bar, only into a drop
		if _name_at(si + 1) == "drop":
			up = smoothstep(float(s["to"]) - 1.35, float(s["to"]) - 1.0, bw)
	elif str(s["name"]) == "drop":
		var k := clock.dbar   # bars since this drop began
		var q := fposmod(k * 4.0, 16.0)
		up = maxf(1.0 - smoothstep(1.2, 3.0, q), smoothstep(15.4, 16.0, q))
		var j := clampf(q, 0.0, 1.0)
		jump = (0.3 if k < 4.0 else 0.12) * sin(PI * j)
	elif _name_at(si - 1) == "drop":
		# the drop's last phrase ends with both hands up: let them come down over the first beats of what follows
		up = 1.0 - smoothstep(0.0, 3.0, (bw - float(s["from"])) * 4.0)
	if up > 0.0:
		p = _blend(p, _move(M_UP, beat, clock.build), up)
	p[HY] += jump
	p[LF + 1] += jump * 0.85
	p[RF + 1] += jump * 0.85
	return p


# ------------------------------------------------------------------ rig

static func _rot(yaw: float, pitch: float, roll: float) -> Basis:
	return Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, pitch) * Basis(Vector3.BACK, roll)


static func _ik(a: Vector3, t: Vector3, l1: float, l2: float, pole: Vector3) -> Array:
	var d := t - a
	var dist := clampf(d.length(), absf(l1 - l2) + 0.02, l1 + l2 - 0.01)
	var dn := d.normalized() if d.length() > 0.001 else Vector3.DOWN
	var aa := (l1 * l1 - l2 * l2 + dist * dist) / (2.0 * dist)
	var h := sqrt(maxf(l1 * l1 - aa * aa, 0.0))
	var pp := pole - dn * pole.dot(dn)
	pp = pp.normalized() if pp.length() > 0.001 else Vector3.UP
	return [a + dn * aa + pp * h, a + dn * dist]


static func _bx(i: int, basis: Basis, size: Vector3, pos: Vector3) -> void:
	_mm.set_instance_transform(i, Transform3D(basis * Basis.from_scale(size), pos))


static func _limb(i: int, a: Vector3, b: Vector3, th: float) -> void:
	var dv := b - a
	var l := maxf(dv.length(), 0.01)
	_mm.set_instance_transform(i, Transform3D(Architecture.look(dv / l) * Basis.from_scale(Vector3(th, th, l)), (a + b) * 0.5))


static func update(clock: Clock) -> void:
	_secs = clock.secs
	_nbars = clock.nbars
	var p := pose(clock)
	var o := _org
	var bp := _rot(p[HYAW], 0.0, p[HROLL])
	var hip := o + Vector3(p[HX], HIP_H + p[HY], BODY_Z + p[HZ])
	var bs := bp * _rot(p[SYAW], p[SP], p[SR])
	var waist := hip + bp * Vector3(0, 0.1, 0)
	var chest := waist + bs * Vector3(0, 0.26, 0)
	var neck := waist + bs * Vector3(0, 0.55, 0)
	var bh := bs * _rot(p[HDY], p[HDP], p[HDR])
	var head := neck + bh * Vector3(0, 0.14, 0.01)
	_bx(0, bp, Vector3(0.34, 0.2, 0.2), hip)
	_bx(1, bs, Vector3(0.38, 0.5, 0.22), chest)
	_bx(21, bs, Vector3(0.46, 0.14, 0.24), waist + bs * Vector3(0, 0.45, 0))
	_bx(2, bh, Vector3(0.08, 0.1, 0.08), neck + bh * Vector3(0, 0.03, 0))
	_head.position = head
	_head.basis = bh
	# cap and headphones ride the head
	_bx(15, bh, Vector3(0.25, 0.08, 0.27), head + bh * Vector3(0, 0.1, -0.01))
	_bx(16, bh * Basis(Vector3.RIGHT, 0.12), Vector3(0.22, 0.02, 0.15), head + bh * Vector3(0, 0.095, 0.17))
	_bx(17, bh, Vector3(0.27, 0.025, 0.04), head + bh * Vector3(0.0, 0.16, -0.03))
	_bx(18, bh * Basis(Vector3.BACK, -0.0), Vector3(0.025, 0.14, 0.04), head + bh * Vector3(0.135, 0.09, -0.03))
	_bx(19, bh, Vector3(0.06, 0.13, 0.12), head + bh * Vector3(0.14, -0.01, -0.01))
	_bx(20, bh, Vector3(0.02, 0.1, 0.1), head + bh * Vector3(0.115, -0.01, -0.01))
	# arms
	for s in 2:
		var sx := -1.0 if s == 0 else 1.0
		var sh := waist + bs * Vector3(sx * 0.21, 0.46, 0.0)
		var ho := LH if s == 0 else RH
		var tgt := o + Vector3(p[ho], p[ho + 1], p[ho + 2])
		var pole := Vector3(sx * p[ELB], -0.5, -0.3)
		var r := _ik(sh, tgt, UARM, FARM, pole)
		var el: Vector3 = r[0]
		var hd: Vector3 = r[1]
		_limb(3 + s, sh, el, 0.095)
		_limb(5 + s, el, hd, 0.08)
		_bx(7 + s, Basis(), Vector3(0.075, 0.05, 0.1), hd + (hd - el).normalized() * 0.03)
		joints[3 + s] = sh
		joints[5 + s] = el
		joints[7 + s] = hd
	# legs
	for s in 2:
		var sx := -1.0 if s == 0 else 1.0
		var fo := LF if s == 0 else RF
		var hj := hip + bp * Vector3(sx * 0.1, -0.06, 0.0)
		var fp := o + Vector3(sx * 0.19 + p[fo], 0.07 + p[fo + 1], BODY_Z + p[fo + 2])
		var r2 := _ik(hj, fp, THIGH, SHIN, Vector3(sx * 0.15, 0.0, 1.0))
		var kn: Vector3 = r2[0]
		var an: Vector3 = r2[1]
		_limb(9 + s, hj, kn, 0.13)
		_limb(11 + s, kn, an, 0.11)
		_bx(13 + s, Basis(), Vector3(0.11, 0.07, 0.27), an + Vector3(0, -0.02, 0.07))
		joints[9 + s] = kn
		joints[11 + s] = an
	joints[0] = hip
	joints[1] = chest
	joints[2] = head

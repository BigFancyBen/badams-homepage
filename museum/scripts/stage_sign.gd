extends RefCounted
## Stage sign: the second "benadams.dev" neon, set into the deck fascia under the DJ booth. A
## recessed black panel (steel frame proud of the deck face, panel a hair proud of the face, so it
## reads as a niche) carries the marquee's glass-neon look: duplicates of the signage stream's
## neon_tube / neon_core materials (sign_neon / sign_glow shaders, the baked SDF), so nothing of
## theirs is edited. Pulses on drop downbeats like the marquee; its red spill on the deck lip and
## floor and its floor reflection streaks are drawn with Fixtures glow sprites.

const Layout := preload("res://scripts/layout.gd")
const Architecture := preload("res://scripts/architecture.gd")
const Fixtures := preload("res://scripts/fixtures.gd")
const Clock := preload("res://scripts/clock.gd")
const Kit := preload("res://scripts/stage_kit.gd")
const SM := preload("res://scripts/sign_materials.gd")

const PANEL_HW := 3.9      # half width of the dark panel
const PANEL_Y0 := 0.15
const PANEL_Y1 := 1.05
const QUAD_H := 1.2        # the SDF quad is taller than the panel; the ink fills ~0.75 of it
const QUAD_W := 1.2 * 3.828037

static var _tube: ShaderMaterial
static var _core: ShaderMaterial
static var _panel: ShaderMaterial
static var _cy: float = 0.6
static var _z: float = -104.0
static var _lv := PackedFloat32Array()


static func build(root: Node3D) -> void:
	_z = Layout.ST_Z0
	_cy = (PANEL_Y0 + PANEL_Y1) * 0.5
	# frame: steel bars proud of the face
	var fy := PANEL_Y1 - PANEL_Y0
	Kit.box("steel", Vector3(PANEL_HW * 2.0 + 0.2, 0.06, 0.12), Vector3(0, PANEL_Y1 + 0.03, _z + 0.06), Basis.IDENTITY, 0.8, 0.4)
	Kit.box("steel", Vector3(PANEL_HW * 2.0 + 0.2, 0.06, 0.12), Vector3(0, PANEL_Y0 - 0.03, _z + 0.06), Basis.IDENTITY, 0.8, 0.4)
	for sx in [-1.0, 1.0]:
		Kit.box("steel", Vector3(0.1, fy + 0.12, 0.12), Vector3(sx * (PANEL_HW + 0.05), _cy, _z + 0.06), Basis.IDENTITY, 0.8, 0.4)
	# the panel itself: near-black rubber, a touch proud of the fascia, in a ShaderMaterial of the
	# stage kit (so no new shader to compile)
	Kit.box("rubber", Vector3(PANEL_HW * 2.0, fy, 0.03), Vector3(0, _cy, _z + 0.015), Basis.IDENTITY, 0.18, 0.5, 0.0)
	# neon layers
	_tube = (SM.get_mat("neon_tube") as ShaderMaterial).duplicate() as ShaderMaterial
	_core = (SM.get_mat("neon_core") as ShaderMaterial).duplicate() as ShaderMaterial
	_lv.resize(12)
	_lv.fill(1.0)
	_tube.set_shader_parameter("lv", _lv)
	_core.set_shader_parameter("lv", _lv)
	var q := QuadMesh.new()
	q.size = Vector2(QUAD_W, QUAD_H)
	Architecture.mi(root, q, _tube, Vector3(0, _cy, _z + 0.07))
	Architecture.mi(root, q, _core, Vector3(0, _cy, _z + 0.10))


## Drive the sign from the song clock. lvl = the show's level (0..1).
static func update(clock: Clock, lvl: float) -> void:
	var flash := clock.down if clock.is_drop else 0.0
	var e := clock.e
	var lv := (0.9 + 0.1 * e + 0.3 * flash) * (0.35 + 0.65 * clock.black)
	for m in [_tube, _core]:
		m.set_shader_parameter("level", lv)
		m.set_shader_parameter("flash", flash)
	var red := Color(1.0, 0.1, 0.08)
	var g := (0.55 + 0.25 * e + 0.5 * flash) * (0.3 + 0.7 * clock.black)
	# spill on the deck lip and the floor in front, plus a halo behind the script
	for i in 7:
		var x := (float(i) / 6.0 - 0.5) * 6.4
		Fixtures.glow_bb(Vector3(x, _cy - 0.1, _z + 0.5), 1.9, red * (0.16 * g))
		Fixtures.streak(Vector3(x, 0.0, _z + 0.6), 0.9, 6.0, red * (0.55 * g))
	Fixtures.glow_floor(Vector3(0, 0.0, _z + 2.4), 9.0, red * (0.22 * g))

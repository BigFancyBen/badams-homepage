extends RefCounted
## Signage materials, built locally (not in materials.gd): neon_tube neon_core neon_conduit
## bulb_chaser bulb_soffit marquee_panel plaque_brass, plus sign_steel, sign_halo_chaser,
## sign_halo_soffit, sign_soffit and the per-bay plate. SignMaterials.get_mat(name).

const TexData := preload("res://scripts/sign_text_data.gd")
const Materials := preload("res://scripts/materials.gd")

static var _cache: Dictionary = {}
static var _plates: Dictionary = {}
static var _sdf: Texture2D
static var _idt: Texture2D


static func get_mat(mat_name: String) -> Material:
	if not _cache.has(mat_name):
		_cache[mat_name] = _make(mat_name)
	return _cache[mat_name]


static func sdf_tex() -> Texture2D:
	if _sdf == null:
		_sdf = load("res://textures/sign_text_sdf.png")
	return _sdf


static func id_tex() -> Texture2D:
	if _idt == null:
		_idt = load("res://textures/sign_text_id.png")
	return _idt


static func plate(b: int) -> ShaderMaterial:
	if not _plates.has(b):
		var m := ShaderMaterial.new()
		m.shader = load("res://shaders/plate.gdshader")
		m.set_shader_parameter("alb", _t("brass", "albedo"))
		m.set_shader_parameter("nrm", _t("brass", "normal"))
		m.set_shader_parameter("rgh", _t("brass", "roughness"))
		m.set_shader_parameter("tx", _noise())
		m.set_shader_parameter("seed", float(b) * 0.173 + 0.05)
		var blank := Image.create(8, 8, false, Image.FORMAT_L8)
		m.set_shader_parameter("mask", ImageTexture.create_from_image(blank))
		_plates[b] = m
	return _plates[b]


static func _t(set_name: String, map: String) -> Texture2D:
	return load("res://assets/textures/%s/%s.jpg" % [set_name, map])


static var _nz: ImageTexture


static func _noise() -> ImageTexture:
	if _nz == null:
		var n := FastNoiseLite.new()
		n.seed = 31
		n.frequency = 0.02
		n.fractal_type = FastNoiseLite.FRACTAL_FBM
		n.fractal_octaves = 4
		var img := n.get_seamless_image(256, 256, false, false, 0.1, true)
		img.generate_mipmaps()
		_nz = ImageTexture.create_from_image(img)
	return _nz


static func _neon(path: String) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load(path)
	m.set_shader_parameter("sdf", sdf_tex())
	m.set_shader_parameter("idt", id_tex())
	m.set_shader_parameter("hw", TexData.HALF_STROKE_PX / (2.0 * TexData.SPREAD_PX))
	var lv := PackedFloat32Array()
	lv.resize(12)
	lv.fill(1.0)
	m.set_shader_parameter("lv", lv)
	return m


## A scanned surface in the hall's own material (Materials.pbr), world-space triplanar. These were
## StandardMaterial3Ds; each of those cost a lit-shader compile (see shaders/lite.gdshaderinc).
static func _tri(set_name: String, col: Color, metal: float, rough_mul: float, scale_v: float, emission: Color = Color.BLACK) -> ShaderMaterial:
	var m := Materials.pbr(set_name, {"uv_scale": scale_v, "tint": col, "metallic": metal, "roughness_mult": rough_mul})
	m.set_shader_parameter("emission", emission)
	return m


static func _make(mat_name: String) -> Material:
	match mat_name:
		"neon_tube":
			return _neon("res://shaders/sign_neon.gdshader")
		"neon_core":
			return _neon("res://shaders/sign_glow.gdshader")
		"marquee_panel":
			var f := _neon("res://shaders/sign_face.gdshader") as ShaderMaterial
			f.set_shader_parameter("alb", _t("steel_black", "albedo"))
			f.set_shader_parameter("nrm", _t("steel_black", "normal"))
			f.set_shader_parameter("rgh", _t("steel_black", "roughness"))
			return f
		"neon_conduit":
			return _tri("steel_black", Color(0.55, 0.52, 0.5), 0.85, 0.9, 0.8)
		"sign_steel":
			return _tri("steel_black", Color(0.62, 0.6, 0.6), 0.8, 0.9, 0.5, Color(0.045, 0.04, 0.045))
		"plaque_brass":
			return _tri("brass", Color(0.78, 0.55, 0.22), 0.9, 0.85, 0.9, Color(0.2, 0.12, 0.035))
		"sign_soffit":
			return _tri("steel_black", Color(1.0, 0.12, 0.13), 0.2, 0.7, 0.5, Color(0.1, 0.01, 0.012))
		"bulb_chaser", "bulb_soffit":
			var b := ShaderMaterial.new()
			b.shader = load("res://shaders/sign_bulb.gdshader")
			return b
		"sign_halo_chaser", "sign_halo_soffit":
			var h := ShaderMaterial.new()
			h.shader = load("res://shaders/sign_halo.gdshader")
			return h
	push_error("SignMaterials: unknown " + mat_name)
	return null

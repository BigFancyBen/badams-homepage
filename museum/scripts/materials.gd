extends RefCounted
## Materials: the material library. Every material and texture the scene uses is made here and
## handed out by role name, so other modules never build materials themselves.
##
## Materials.get_mat("floor") -> Material (cached, shared). Names:
##   floor wall ceiling column wood_dark stone trim_brass plaque_brass truss frame frame_step
##   mat_board velvet marquee_panel stage_deck led_red stage_screen mirror_ball neon_tube
##   neon_core neon_conduit bulb_chaser bulb_soffit beam_glow beam_cone laser_stick fixture_head
## Per-instance factories: Materials.art(tex) (a picture), Materials.plate(b) (a bay's plaque).
##
## Scanned surfaces (assets/textures/<set>/): floor wall ceiling column stone wood_dark trim_brass
## truss frame frame_step mat_board velvet stage_deck fixture_head. The emissive/effect materials
## (neon_*, bulb_*, beam_*, laser_*, led_red, stage_screen, mirror_ball, plaque_brass,
## marquee_panel) are not scans; other streams own those looks.
##   floor     mat_floor.gdshader    black marble in 0.8 m slabs with seams (world xz)
##   wall      mat_wall.gdshader     plaster (wainscot_h defaults to 0: architecture builds it as geometry)
##   ceiling   mat_ceiling.gdshader  coffers in the plaster scan (world xz)
##   column    mat_column.gdshader   fluted limestone (object-space angle)
##   the rest  Materials.pbr(), world-space triplanar (the code-built boxes have no useful UVs):
##             stone = plaster scan, darker; wood_dark/frame_step = walnut; trim_brass/frame =
##             aged gold; truss/fixture_head = blackened steel; velvet = crimson with sheen;
##             stage_deck = painted planks; mat_board = plaster scan, cream.
##
## Materials.pbr(set_name, opts = {}) -> ShaderMaterial    (stable API)
## Returns a NEW material each call; share the result yourself. set_name is a folder in
## assets/textures/ (floor wall wood_dark brass velvet steel_black stage_deck rubber_black).
## opts, all optional:
##   uv_scale         texture repeats per world metre (default 1.0; 0.5 = one repeat per 2 m)
##   triplanar        bool, default true: world-space projection, a single texture fetch on any flat
##                    axis-aligned face. false = the mesh's own UV * uv_scale (needs good UVs)
##   tint             Color multiplied into the albedo (default white)
##   roughness_mult   multiplies the roughness map (default 1.0)
##   normal_strength  normal map strength (default 1.0)
##   metallic         multiplies the set's metallic map (brass, steel_black), else a constant
##                    (default 1.0 with a map, 0.0 without)
##   spec             specular amount 0..1 (default 0.5)
##   grain_swap       bool: on top faces run texture U along world z instead of x (wood grain)
##   sheen            Color added at grazing angles (velvet); sheen_pow sets the falloff (3.0)
##   ao               bool, default true: use the set's AO map where it has one
## Vertex COLOR.rgb (baked AO from architecture) multiplies the albedo in mat_pbr/wall/ceiling/column;
## meshes without vertex colours give white. Callers must NOT swap in a StandardMaterial3D: duplicate
## the ShaderMaterial instead.
## Mobile tier (Post.Tier.MOBILE): no AO map, no metallic map (a constant instead), and
## triplanar picks the one dominant axis instead of blending, so each map is one fetch.

const Post := preload("res://scripts/post.gd")

const TEX := "res://assets/textures/%s/%s.jpg"

## aged gold: the pale scanned brass pulled down to a warm, slightly dull gold
const BRASS := {"uv_scale": 4.0, "tint": Color(0.62, 0.45, 0.22), "roughness_mult": 1.15, "normal_strength": 0.7, "metallic": 0.65}

static var _cache: Dictionary = {}
static var _tex_cache: Dictionary = {}
static var _tx_a: ImageTexture
static var _tx_n: ImageTexture
static var _plates: Dictionary = {}


static func get_mat(mat_name: String) -> Material:
	if not _cache.has(mat_name):
		_cache[mat_name] = _make(mat_name)
	return _cache[mat_name]


## A scanned PBR material (see the header for opts).
static func pbr(set_name: String, opts: Dictionary = {}) -> ShaderMaterial:
	var mobile := Post.tier == Post.Tier.MOBILE
	var m := _sh("res://shaders/mat_pbr.gdshader")
	_set_maps(m, set_name, "tex_a", "tex_n", "tex_r")
	var met_tex := _tex(set_name, "metallic")
	var ao_tex := _tex(set_name, "ao")
	var has_m := not mobile and met_tex != null
	if has_m:
		m.set_shader_parameter("tex_m", met_tex)
	m.set_shader_parameter("use_m", has_m)
	var has_ao := not mobile and bool(opts.get("ao", true)) and ao_tex != null
	if has_ao:
		m.set_shader_parameter("tex_ao", ao_tex)
	m.set_shader_parameter("use_ao", has_ao)
	m.set_shader_parameter("cheap", mobile)
	m.set_shader_parameter("triplanar", bool(opts.get("triplanar", true)))
	m.set_shader_parameter("grain_swap", bool(opts.get("grain_swap", false)))
	m.set_shader_parameter("uv_scale", float(opts.get("uv_scale", 1.0)))
	m.set_shader_parameter("tint", opts.get("tint", Color.WHITE))
	m.set_shader_parameter("roughness_mult", float(opts.get("roughness_mult", 1.0)))
	m.set_shader_parameter("normal_strength", float(opts.get("normal_strength", 1.0)))
	var met := float(opts.get("metallic", 1.0 if met_tex != null else 0.0))
	if mobile and met_tex != null:
		met *= 0.85  # no map on mobile: the sets' average
	m.set_shader_parameter("metallic", met)
	m.set_shader_parameter("spec", float(opts.get("spec", 0.5)))
	if opts.has("sheen"):
		m.set_shader_parameter("sheen_color", opts["sheen"])
		m.set_shader_parameter("sheen_pow", float(opts.get("sheen_pow", 3.0)))
	return m


## A picture material for an exhibit screenshot (one per quad: its level is animated). It shows the
## source true-colour: shaders/art.gdshader undoes the tonemap + grade with the tier's inverse LUT.
static func art(tex: Texture2D) -> ShaderMaterial:
	var pm := ShaderMaterial.new()
	pm.shader = load("res://shaders/art.gdshader")
	pm.set_shader_parameter("albedo_tex", tex)
	pm.set_shader_parameter("lut", _art_lut())
	return pm


static var _lut: ImageTexture3D = null

## The picture inverse-tonemap LUT for the active tier (40^3 half-float RGBA, one file per tier).
static func _art_lut() -> ImageTexture3D:
	if _lut != null:
		return _lut
	var n := 40
	var f := "res://textures/art_lut_%s.bin" % ("mobile" if Post.tier == Post.Tier.MOBILE else "desktop")
	var bytes := FileAccess.get_file_as_bytes(f)
	var slices: Array[Image] = []
	var sz := n * n * 8
	for z in n:
		slices.append(Image.create_from_data(n, n, false, Image.FORMAT_RGBAH, bytes.slice(z * sz, (z + 1) * sz)))
	_lut = ImageTexture3D.new()
	_lut.create(Image.FORMAT_RGBAH, n, n, n, false, slices)
	return _lut


## The engraved brass plate of bay b (its text mask is baked later by Signage).
static func plate(b: int) -> ShaderMaterial:
	if not _plates.has(b):
		var plm := ShaderMaterial.new()
		plm.shader = load("res://shaders/plate.gdshader")
		plm.set_shader_parameter("tx", _ta())
		plm.set_shader_parameter("seed", float(b) * 0.137)
		var blank := Image.create(8, 8, false, Image.FORMAT_L8)
		plm.set_shader_parameter("mask", ImageTexture.create_from_image(blank))
		_plates[b] = plm
	return _plates[b]


# ---------------------------------------------------------------- internals

static func _tex(set_name: String, map: String) -> Texture2D:
	var path := TEX % [set_name, map]
	if not _tex_cache.has(path):
		_tex_cache[path] = load(path) if ResourceLoader.exists(path) else null
	return _tex_cache[path]


static func _set_maps(m: ShaderMaterial, set_name: String, a: String, n: String, r: String) -> void:
	m.set_shader_parameter(a, _tex(set_name, "albedo"))
	m.set_shader_parameter(n, _tex(set_name, "normal"))
	m.set_shader_parameter(r, _tex(set_name, "roughness"))


## Procedural noise: only the bay plaques (plate.gdshader, owned by the signage stream) still use it.
static func _noise_tex(seed_v: int, freq: float, oct: int, size: int, normal: bool) -> ImageTexture:
	var n := FastNoiseLite.new()
	n.seed = seed_v
	n.frequency = freq
	n.fractal_type = FastNoiseLite.FRACTAL_FBM
	n.fractal_octaves = oct
	var img := n.get_seamless_image(size, size, false, false, 0.1, true)
	if normal:
		img.bump_map_to_normal_map(5.0)
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


static func _ta() -> ImageTexture:
	if _tx_a == null:
		_tx_a = _noise_tex(11, 0.012, 5, 512, false)
	return _tx_a


static func _sh(path: String) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = load(path)
	return m


static func _std(col: Color, emis: Color, metal: float, rough: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.emission_enabled = true
	m.emission = emis
	m.metallic = metal
	m.roughness = rough
	return m


static func _unshaded(col: Color, vertex_col: bool = false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = col
	if vertex_col:
		m.vertex_color_use_as_albedo = true
	return m


static func _make(mat_name: String) -> Material:
	match mat_name:
		# ---- shell
		"floor":
			var fm := _sh("res://shaders/mat_floor.gdshader")
			_set_maps(fm, "floor", "tex_a", "tex_n", "tex_r")
			return fm
		"wall":
			var wm := _sh("res://shaders/mat_wall.gdshader")
			_set_maps(wm, "wall", "pl_a", "pl_n", "pl_r")
			_set_maps(wm, "wood_dark", "wd_a", "wd_n", "wd_r")
			return wm
		"ceiling":
			var cm := _sh("res://shaders/mat_ceiling.gdshader")
			_set_maps(cm, "wall", "pl_a", "pl_n", "pl_r")
			cm.set_shader_parameter("br_a", _tex("brass", "albedo"))
			return cm
		"column":
			var com := _sh("res://shaders/mat_column.gdshader")
			_set_maps(com, "wall", "tex_a", "tex_n", "tex_r")
			return com
		"wood_dark":
			return pbr("wood_dark", {"uv_scale": 1.1, "roughness_mult": 1.15, "grain_swap": true, "spec": 0.55})
		"stone":
			return pbr("wall", {"uv_scale": 0.8, "tint": Color(0.5, 0.43, 0.32), "normal_strength": 1.6, "roughness_mult": 1.1})
		"trim_brass":
			return pbr("brass", BRASS)
		"plaque_brass":
			return _std(Color(0.8, 0.58, 0.22), Color(0.4, 0.28, 0.07), 0.8, 0.35)
		"truss":
			return pbr("steel_black", {"uv_scale": 2.0, "tint": Color(0.5, 0.5, 0.52), "roughness_mult": 1.1, "normal_strength": 0.8, "metallic": 0.75})
		# ---- exhibits
		"frame":
			var fo := BRASS.duplicate()
			fo["uv_scale"] = 3.0
			fo["metallic"] = 0.6
			fo["tint"] = Color(0.72, 0.55, 0.3)
			return pbr("brass", fo)
		"frame_step":
			return pbr("wood_dark", {"uv_scale": 2.0, "roughness_mult": 1.1, "tint": Color(0.85, 0.82, 0.8)})
		"mat_board":
			return pbr("wall", {"uv_scale": 3.0, "tint": Color(0.78, 0.74, 0.64), "normal_strength": 0.5, "roughness_mult": 1.2, "spec": 0.3})
		"velvet":
			return pbr("velvet", {"uv_scale": 6.0, "tint": Color(0.5, 0.09, 0.1), "spec": 0.25, "normal_strength": 0.8,
					"sheen": Color(0.55, 0.05, 0.09), "sheen_pow": 2.5})
		# ---- marquee
		"marquee_panel":
			return _std(Color(0.05, 0.01, 0.012), Color(0.05, 0.005, 0.005), 0.3, 0.2)
		"neon_tube":
			return _unshaded(Color(1.0, 0.12, 0.1), true)
		"neon_core":
			return _unshaded(Color(1.0, 0.8, 0.75), true)
		"neon_conduit":
			return _unshaded(Color(0.2, 0.035, 0.035))
		"bulb_chaser", "bulb_soffit":
			return _sh("res://shaders/bulb.gdshader")
		# ---- stage
		"stage_deck":
			return pbr("stage_deck", {"uv_scale": 0.5, "tint": Color(1.25, 1.25, 1.3), "roughness_mult": 0.75, "spec": 0.6})
		"led_red":
			return _unshaded(Color(1.0, 0.08, 0.06))
		"stage_screen":
			return _sh("res://shaders/screen.gdshader")
		"mirror_ball":
			return _sh("res://shaders/ball.gdshader")
		# ---- batched fixtures
		"beam_glow":
			return _sh("res://shaders/glow.gdshader")
		"beam_cone":
			return _sh("res://shaders/cone.gdshader")
		"laser_stick":
			return _sh("res://shaders/stick.gdshader")
		"fixture_head":
			return pbr("steel_black", {"uv_scale": 4.0, "tint": Color(0.38, 0.38, 0.4), "normal_strength": 0.6, "metallic": 0.75})
	push_error("Materials: unknown material '%s'" % mat_name)
	return _unshaded(Color(1.0, 0.0, 1.0))

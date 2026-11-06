extends RefCounted
## ExhibitsBuild: per-bay exhibit content from exhibits.json. Owns the art quads (one picture
## each, up to 3 per bay), their frames and mat boards, the spot that lights each picture, and
## the plinth/stand/rope dressing of the bay. Geometry helpers live in architecture.gd.

const Layout := preload("res://scripts/layout.gd")
const Materials := preload("res://scripts/materials.gd")
const Architecture := preload("res://scripts/architecture.gd")
const Fixtures := preload("res://scripts/fixtures.gd")

static var _pics: Array = []        # per bay: Array of ShaderMaterial, one per art quad
static var _frames: Array = []      # per bay: Array of [Vector3 centre, Vector2 size]


## `tick` is awaited after each bay, so the page gets to repaint between them (see hall.gd).
static func build(root: Node3D, exhibits: Array, tick: Callable) -> void:
	_pics.clear()
	_frames.clear()
	for b in exhibits.size():
		_build_bay(root, exhibits, b)
		await tick.call()


static func _build_bay(root: Node3D, exhibits: Array, b: int) -> void:
	var side := Layout.bay_side(b)
	var z := Layout.bay_z(b)
	var tex_paths: Array = exhibits[b].get("textures", [])
	var mats: Array = []
	var frm: Array = []
	for i in mini(tex_paths.size(), 3):
		var tex: Texture2D = load(str(tex_paths[i]))
		if tex == null:
			continue
		var sl: Array = Layout.ART_SLOTS[i]
		var ts := tex.get_size()
		var sc := minf(float(sl[1]) / ts.x, float(sl[2]) / ts.y)
		var w := ts.x * sc
		var h := ts.y * sc
		var zoff: float = sl[0]
		var cy: float = float(sl[3]) + 0.2   # lifted clear of the dado rail
		var pm := Materials.art(tex)
		var q := QuadMesh.new()
		q.size = Vector2(w, h)
		var pic := Architecture.mi(root, q, pm, Vector3(side * 6.92, cy, z + zoff))
		pic.rotation.y = Layout.bay_yaw(b)
		mats.append(pm)
		Architecture.frame(side, cy, z + zoff, w, h)
		frm.append([Vector3(side * 6.92, cy, z + zoff), Vector2(w, h)])
		# spot(s) on the picture: two for the big one
		var nsp := 2 if i == 0 else 1
		for sidx in nsp:
			var off := 0.0 if nsp == 1 else (-1.0 if sidx == 0 else 1.0) * w * 0.28
			var src := Vector3(side * 3.6, 8.1, z + zoff + off * 1.5)
			var tgt := Vector3(side * 6.92, cy, z + zoff + off)
			Fixtures.add_art_light(b, src, tgt)
	_pics.append(mats)
	_frames.append(frm)
	Architecture.plinth(b)
	Architecture.stanchions(b)


## Set bay b's picture brightness (displayed brightness, 1 = the source image).
static func set_art_level(b: int, g: float) -> void:
	for m in _pics[b]:
		(m as ShaderMaterial).set_shader_parameter("level", g)


## Show a video in bay b's main picture (exhibit_video.gd): its frames, and how far it has faded in (0 the still).
static func set_video(b: int, tex: Texture2D, mix: float) -> void:
	if b < 0 or b >= _pics.size() or (_pics[b] as Array).is_empty():
		return
	var m := _pics[b][0] as ShaderMaterial
	m.set_shader_parameter("video_tex", tex)
	m.set_shader_parameter("video_mix", mix if tex != null else 0.0)


## Bay b's frames: Array of [Vector3 centre on the wall, Vector2 picture size].
static func frames(b: int) -> Array:
	return _frames[b]

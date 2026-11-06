extends RefCounted
## Warm: compiles every shader variant the hall uses while the page still shows its poster.
##
## WebGL compiles a shader at the first draw that uses it, and a browser does that on the main
## thread: on Windows (ANGLE over Direct3D) a cold first frame of the whole hall hung the tab for
## close to a minute. So the hall is built hidden, and this reveals one representative of each
## distinct (shader, mesh format, instancing) combination in turn, one frame each, so each hitch is
## a single compile, the page gets to repaint its loading bar between them, and the visitor's real
## first frame has nothing left to compile. Chrome keeps the compiled programs in its GPU shader
## cache, so on a return visit every step is fast.
##
## Usage: Warm.hide(hall) right after building; then `await Warm.run(hall, progress)`; run() puts
## everything back and returns when the last frame has been drawn. progress(fraction) is called
## after each step.

const Fixtures := preload("res://scripts/fixtures.gd")

## a node far outside the frustum still draws (and so compiles) once its cull box covers the world
const HUGE_MARGIN := 16384.0

static var _nodes: Array[GeometryInstance3D] = []
static var _was_visible: Array[bool] = []


static func hide(root: Node) -> void:
	_nodes.clear()
	_was_visible.clear()
	_collect(root)
	for n in _nodes:
		_was_visible.append(n.visible)
		n.visible = false


static func run(root: Node, progress: Callable) -> void:
	var reps: Array[GeometryInstance3D] = []
	var seen := {}
	for n in _nodes:
		var k := _key(n)
		if seen.has(k):
			continue
		seen[k] = true
		reps.append(n)
	Fixtures.warm_min = 1
	# the empty frame: environment, glow, tonemap and the canvas overlay compile here
	await RenderingServer.frame_post_draw
	progress.call(1.0 / float(reps.size() + 1))
	var i := 0
	for n in reps:
		i += 1
		var margin := n.extra_cull_margin
		n.extra_cull_margin = HUGE_MARGIN
		n.visible = true
		await RenderingServer.frame_post_draw
		n.visible = false
		n.extra_cull_margin = margin
		progress.call(float(i + 1) / float(reps.size() + 1))
	Fixtures.warm_min = 0
	for j in _nodes.size():
		if is_instance_valid(_nodes[j]):
			_nodes[j].visible = _was_visible[j]
	_nodes.clear()
	_was_visible.clear()


## Headless runs have nothing to compile and no frames to await: just show everything again.
static func run_headless() -> void:
	for j in _nodes.size():
		if is_instance_valid(_nodes[j]):
			_nodes[j].visible = _was_visible[j]
	_nodes.clear()
	_was_visible.clear()


static func _collect(n: Node) -> void:
	if n is GeometryInstance3D:
		_nodes.append(n)
	for c in n.get_children():
		_collect(c)


## What decides the compiled program: the shader (or built-in material flavour), and the vertex
## layout and instancing the mesh brings.
static func _key(n: GeometryInstance3D) -> String:
	var mat: Material = n.material_override
	var m := "none"
	if mat is ShaderMaterial and (mat as ShaderMaterial).shader != null:
		m = "s%d" % (mat as ShaderMaterial).shader.get_instance_id()
	elif mat != null:
		m = mat.get_class()
	var mesh: Mesh = null
	var inst := ""
	if n is MeshInstance3D:
		mesh = (n as MeshInstance3D).mesh
	elif n is MultiMeshInstance3D:
		var mm := (n as MultiMeshInstance3D).multimesh
		if mm != null:
			mesh = mm.mesh
			inst = "mm%d%d%d" % [int(mm.use_colors), int(mm.use_custom_data), mm.transform_format]
	var f := 0
	# surface_get_format exists only on ArrayMesh; primitive meshes (BoxMesh...) key by class.
	if mesh is ArrayMesh and mesh.get_surface_count() > 0:
		f = (mesh as ArrayMesh).surface_get_format(0)
	elif mesh != null:
		f = hash(mesh.get_class())
	return "%s|%s|%d" % [m, inst, f]

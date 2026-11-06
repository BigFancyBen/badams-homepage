extends RefCounted
## Procedural mouldings for the signage: a rectangular ring swept along a profile (flat-shaded,
## so the bevels catch light as edges).


## Ring of outer half-extents (hw, hh) around the origin in the XY plane, facing +Z. profile is a
## list of Vector2(inset from the outer edge, z), from the outside inwards.
static func ring(hw: float, hh: float, profile: Array, uv_scale: float = 0.6) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var loops: Array = []
	for p in profile:
		var i: float = p.x
		var z: float = p.y
		loops.append([Vector3(-(hw - i), -(hh - i), z), Vector3(hw - i, -(hh - i), z), Vector3(hw - i, hh - i, z), Vector3(-(hw - i), hh - i, z)])
	for k in loops.size() - 1:
		var A: Array = loops[k]
		var B: Array = loops[k + 1]
		for s in 4:
			var a0: Vector3 = A[s]
			var a1: Vector3 = A[(s + 1) % 4]
			var b0: Vector3 = B[s]
			var b1: Vector3 = B[(s + 1) % 4]
			for v in [a0, b0, b1, a0, b1, a1]:
				st.set_uv(Vector2(v.x, v.y) * uv_scale + Vector2(v.z, v.z) * 0.3)
				st.add_vertex(v)
	st.generate_normals()
	return st.commit()

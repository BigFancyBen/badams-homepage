// Shared helpers for the mat_* shaders: world-space triplanar sampling that costs a single fetch
// on a flat axis-aligned face (all the hall's boxes) and blends three only on curved or angled
// surfaces. Weights are computed once; per-plane fetches use textureGrad so branching is safe.

struct Tri {
	vec3 w;      // blend weights (sum 1)
	vec2 uv[3];  // plane uvs: x-plane (z,y), y-plane (x,z), z-plane (x,y)
	vec2 dx[3];
	vec2 dy[3];
};

Tri tri_setup(vec3 wp, vec3 wn, float scale, bool swap_y, float sharp, bool cheap) {
	Tri t;
	vec3 a = pow(abs(wn), vec3(sharp));
	if (cheap) {
		if (a.x >= a.y && a.x >= a.z) a = vec3(1.0, 0.0, 0.0);
		else if (a.y >= a.z) a = vec3(0.0, 1.0, 0.0);
		else a = vec3(0.0, 0.0, 1.0);
	}
	t.w = a / max(a.x + a.y + a.z, 0.0001);
	vec3 p = wp * scale;
	t.uv[0] = vec2(p.z, p.y);
	t.uv[1] = swap_y ? vec2(p.z, p.x) : vec2(p.x, p.z);
	t.uv[2] = vec2(p.x, p.y);
	vec3 ddx = dFdx(p);
	vec3 ddy = dFdy(p);
	t.dx[0] = vec2(ddx.z, ddx.y); t.dy[0] = vec2(ddy.z, ddy.y);
	t.dx[1] = swap_y ? vec2(ddx.z, ddx.x) : vec2(ddx.x, ddx.z);
	t.dy[1] = swap_y ? vec2(ddy.z, ddy.x) : vec2(ddy.x, ddy.z);
	t.dx[2] = vec2(ddx.x, ddx.y); t.dy[2] = vec2(ddy.x, ddy.y);
	return t;
}

// Samplers with different hints cannot share a function, so the fetches are macros.
#define TRI_FETCH(s, t, i) (t.w[i] > 0.001 ? textureGrad(s, t.uv[i], t.dx[i], t.dy[i]) * t.w[i] : vec4(0.0))
#define tri_sample(s, t) (TRI_FETCH(s, t, 0) + TRI_FETCH(s, t, 1) + TRI_FETCH(s, t, 2))
#define TRI_FETCH_N(s, t, i) (t.w[i] > 0.001 ? textureGrad(s, t.uv[i], t.dx[i], t.dy[i]).xyz * 2.0 - 1.0 : vec3(0.0))

// Whiteout-blended triplanar normal map from the three plane fetches; returns a world-space normal.
// OpenGL normal maps point toward -v in Godot's image-space uv, so green is flipped.
vec3 tri_normal(vec3 tx, vec3 ty, vec3 tz, Tri t, vec3 wn, float strength) {
	vec3 n = vec3(0.0);
	if (t.w.x > 0.001) {
		vec2 d = vec2(tx.x, -tx.y) * strength;
		n += vec3(abs(tx.z) * wn.x, d.y + wn.y, d.x + wn.z) * t.w.x;
	}
	if (t.w.y > 0.001) {
		vec2 d = vec2(ty.x, -ty.y) * strength;
		n += vec3(d.x + wn.x, abs(ty.z) * wn.y, d.y + wn.z) * t.w.y;
	}
	if (t.w.z > 0.001) {
		vec2 d = vec2(tz.x, -tz.y) * strength;
		n += vec3(d.x + wn.x, d.y + wn.y, abs(tz.z) * wn.z) * t.w.z;
	}
	return normalize(n);
}

#define tri_normal_s(s, t, wn, k) tri_normal(TRI_FETCH_N(s, t, 0), TRI_FETCH_N(s, t, 1), TRI_FETCH_N(s, t, 2), t, wn, k)

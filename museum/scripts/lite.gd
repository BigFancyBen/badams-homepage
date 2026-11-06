extends RefCounted
## Lite: the two real lights and the ambient colour, as global shader parameters read by
## shaders/lite.gdshaderinc (see its header for why the hall does not use Light3D nodes).
## setup() must run before any shader that includes the lighting is loaded.

const SPOT_RANGE := 17.0
const SPOT_ANGLE_DEG := 44.0
const SPOT_ATTEN := 1.0          # Godot's default distance falloff exponent
const OMNI_RANGE := 17.0
const OMNI_ATTEN := 1.3

static var _registered := false


## `ambient` is the sRGB colour and `energy` the strength the Environment used to have.
static func setup(ambient: Color, energy: float) -> void:
	if not _registered:
		_registered = true
		RenderingServer.global_shader_parameter_add("lt_ambient", RenderingServer.GLOBAL_VAR_TYPE_VEC3, Vector3.ZERO)
		for n in ["lt_spot_pos", "lt_spot_dir", "lt_spot_col", "lt_omni_pos", "lt_omni_col"]:
			RenderingServer.global_shader_parameter_add(n, RenderingServer.GLOBAL_VAR_TYPE_VEC4, Vector4(0, 0, 0, 0))
	var a := ambient.srgb_to_linear()
	RenderingServer.global_shader_parameter_set("lt_ambient", Vector3(a.r, a.g, a.b) * energy)
	RenderingServer.global_shader_parameter_set("lt_spot_pos", Vector4(0, 10, 0, SPOT_RANGE))
	RenderingServer.global_shader_parameter_set("lt_spot_dir", Vector4(0, -1, 0, cos(deg_to_rad(SPOT_ANGLE_DEG))))
	RenderingServer.global_shader_parameter_set("lt_omni_pos", Vector4(0, 10, 0, OMNI_RANGE))
	spot(Vector3.ZERO, Vector3.DOWN, Color.BLACK, 0.0)
	omni(Vector3.ZERO, Color.BLACK, 0.0)


## The spot on the viewed bay: from `pos` towards `dir`, colour * energy (0 = off). The colour is used
## as given, not converted from sRGB: that is what the compatibility renderer's own lights did.
static func spot(pos: Vector3, dir: Vector3, color: Color, energy: float) -> void:
	var c := color
	RenderingServer.global_shader_parameter_set("lt_spot_pos", Vector4(pos.x, pos.y, pos.z, SPOT_RANGE))
	RenderingServer.global_shader_parameter_set("lt_spot_dir", Vector4(dir.x, dir.y, dir.z, cos(deg_to_rad(SPOT_ANGLE_DEG))))
	RenderingServer.global_shader_parameter_set("lt_spot_col", Vector4(c.r * energy, c.g * energy, c.b * energy, SPOT_ATTEN))


## The room flash (strobes and blinders): an omni at `pos`, colour * energy (0 = off).
static func omni(pos: Vector3, color: Color, energy: float) -> void:
	var c := color
	RenderingServer.global_shader_parameter_set("lt_omni_pos", Vector4(pos.x, pos.y, pos.z, OMNI_RANGE))
	RenderingServer.global_shader_parameter_set("lt_omni_col", Vector4(c.r * energy, c.g * energy, c.b * energy, OMNI_ATTEN))

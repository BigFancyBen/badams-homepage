extends SceneTree
## Offline tool (not used at runtime): bakes the bay plaques' text masks.
##   textures/plaques/<exhibit id>.png   L8, 1536 x 634, mipmapped (the .import is written alongside)
## Run it windowed, because it renders text through SubViewports (so through the queue, with a
## window): scripts/museum-bake.mjs does that and then re-imports. Re-run it whenever an exhibit's
## title in exhibits.json changes, or the plaque layout in signage.gd does.

const Signage := preload("res://scripts/signage.gd")

const IMPORT := """[remap]

importer="texture"
type="CompressedTexture2D"

[params]

compress/mode=0
compress/high_quality=false
compress/lossy_quality=0.7
compress/hdr_compression=1
compress/normal_map=0
compress/channel_pack=0
mipmaps/generate=true
mipmaps/limit=-1
roughness/mode=0
roughness/src_normal=""
process/fix_alpha_border=false
process/premult_alpha=false
process/normal_map_invert_y=false
process/hdr_as_srgb=false
process/hdr_clamp_exposure=false
process/size_limit=0
detect_3d/compress_to=0
"""

var _started := false


func _process(_dt: float) -> bool:
	if _started:
		return false
	_started = true
	_run()
	return false


func _run() -> void:
	var f := FileAccess.open("res://exhibits.json", FileAccess.READ)
	var exhibits: Array = JSON.parse_string(f.get_as_text())
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(Signage.MASK_DIR))
	var imgs: Array[Image] = await Signage.render_plaque_masks(root, exhibits)
	for b in exhibits.size():
		var path: String = Signage.mask_path(exhibits[b])
		var img := imgs[b]
		if img == null or img.get_width() < 8:
			push_error("no image for " + path)
			continue
		img.save_png(path)
		var imp := FileAccess.open(path + ".import", FileAccess.WRITE)
		imp.store_string(IMPORT)
		imp.close()
		print("baked ", path, " ", img.get_width(), "x", img.get_height())
	quit()

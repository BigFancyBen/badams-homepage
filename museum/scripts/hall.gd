extends Node3D
## Hall: thin composer. Builds the world by calling each module's build(root) in dependency
## order, then drives the per-frame show by calling each module's update(clock, focus).
## No geometry, materials or light logic lives here; see the module headers:
##   layout (dimensions, stops, poses)   clock (song time)       materials (library)
##   architecture (shell, batches)       exhibits_build (bays)   signage (marquee, plaques)
##   fixtures (lighting hardware)        show (bay light show)   stage (far end)   post (look)
##
## focus passed to update(): {"bay": int (-1 none), "cam_basis": Basis, "cam_pos": Vector3}.

const Clock := preload("res://scripts/clock.gd")
const Post := preload("res://scripts/post.gd")
const Architecture := preload("res://scripts/architecture.gd")
const Fixtures := preload("res://scripts/fixtures.gd")
const ExhibitsBuild := preload("res://scripts/exhibits_build.gd")
const Signage := preload("res://scripts/signage.gd")
const Stage := preload("res://scripts/stage.gd")
const Show := preload("res://scripts/show.gd")
const Perf := preload("res://scripts/perf.gd")

var _exhibits: Array = []


## Builds the world one module at a time. `step` is called (and awaited) after each module with
## the fraction done, so the caller can let the page repaint between modules instead of freezing it
## for the whole build.
func build(exhibits: Array, is_mobile: bool, step: Callable) -> void:
	_exhibits = exhibits
	Perf.mark("hall.build start")
	Post.build(self, is_mobile)
	await _done("Post.build", 0.04, step)
	await Architecture.build(self, exhibits.size(), _tick)
	await _done("Architecture.build", 0.30, step)
	Fixtures.build(self, exhibits.size())
	await _done("Fixtures.build", 0.40, step)
	await ExhibitsBuild.build(self, exhibits, _tick)
	await _done("ExhibitsBuild.build", 0.65, step)
	await Signage.build(self, exhibits, _tick)
	await _done("Signage.build", 0.78, step)
	Stage.build(self)
	await _done("Stage.build", 0.90, step)
	Show.build(self, exhibits)
	Architecture.flush(self)
	await _done("Show.build + Architecture.flush", 1.0, step)


## One frame, so the page can repaint and the browser stay responsive between parts of the build.
func _tick() -> void:
	await get_tree().process_frame


func _done(label: String, fraction: float, step: Callable) -> void:
	Perf.mark(label)
	await step.call(fraction)


func update(clock: Clock, focus: Dictionary) -> void:
	Fixtures.begin(focus["cam_basis"], focus["cam_pos"])
	Show.update(clock, focus)
	Stage.update(clock, focus)
	Signage.update(clock, focus)
	Fixtures.flush()


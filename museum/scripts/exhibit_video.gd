extends Node
## ExhibitVideo: a few exhibits show a short loop of the project in their main frame instead of the
## still (the page lists them: bridge videoUrl(id), "" for none). The .ogv files (Theora, the one format
## the web build plays; scripts/museum-videos.mjs makes them) are fetched one after another in the
## background once the hall is up, into user:// (IndexedDB on the web, so a second visit has them), and
## only the exhibit in focus plays: one decoder at a time keeps the main thread light on phones. The
## art shader crossfades from the still to the video (video_mix) once the first frame is there, and back
## when focus moves on. Reduced motion: no videos. A page hidden or scrolled away pauses it.
##
## Usage: main adds it as a child, calls setup(bridge, exhibits, reduced) once the hall is ready,
## focus(bay) whenever focus changes (-1 none), set_active(visible) every frame.

const ExhibitsBuild := preload("res://scripts/exhibits_build.gd")
const FADE := 0.45        # seconds for the crossfade either way
const DIR := "user://video"

var _urls: Array[String] = []      # per bay, "" when the bay has no video
var _paths: Array[String] = []     # per bay, the local file once downloaded, else ""
var _queue: Array[int] = []
var _http: HTTPRequest
var _busy: int = -1                # bay being downloaded
var _want: int = -1                # the bay in focus
var _bay: int = -1                 # the bay the player is on
var _mix: float = 0.0
var _player: VideoStreamPlayer
var _bridge = null


func setup(bridge, exhibits: Array, reduced: bool) -> void:
	_bridge = bridge
	if bridge == null or reduced or bridge.videoUrl == null:
		return
	DirAccess.make_dir_recursive_absolute(DIR)
	for b in exhibits.size():
		var url := str(bridge.videoUrl(str(exhibits[b]["id"])))
		_urls.append(url)
		_paths.append("")
		if url == "":
			continue
		var path := "%s/%s.ogv" % [DIR, str(url.hash())]
		# a finished download leaves a marker beside it (a cut-short one does not)
		if FileAccess.file_exists(path) and FileAccess.file_exists(path + ".ok"):
			_paths[b] = path
		else:
			_queue.append(b)
	var layer := CanvasLayer.new()
	layer.layer = -100
	add_child(layer)
	_player = VideoStreamPlayer.new()
	_player.size = Vector2(2, 2)
	_player.modulate = Color(1, 1, 1, 0)     # decodes into its texture; never seen itself
	_player.loop = true
	_player.volume_db = -80.0
	layer.add_child(_player)
	_http = HTTPRequest.new()
	_http.request_completed.connect(_on_downloaded)
	add_child(_http)
	# the focused bay first
	_next_download()


func focus(bay: int) -> void:
	_want = bay
	if bay >= 0 and bay < _urls.size() and _urls[bay] != "" and _paths[bay] == "" and _queue.has(bay) and _busy != bay:
		_queue.erase(bay)
		_queue.push_front(bay)


func set_active(on: bool) -> void:
	if _player != null and _player.is_playing():
		_player.paused = not on


func _next_download() -> void:
	if _busy >= 0 or _queue.is_empty():
		return
	_busy = _queue.pop_front()
	if _http.request(_urls[_busy]) != OK:
		_busy = -1


## The body arrives whole (a few MB) and is written out here, then a marker says the file is complete.
func _on_downloaded(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	var b := _busy
	_busy = -1
	var path := "%s/%s.ogv" % [DIR, str(_urls[b].hash())]
	var written := false
	if result == HTTPRequest.RESULT_SUCCESS and code == 200 and body.size() > 1024:
		var f := FileAccess.open(path, FileAccess.WRITE)
		if f != null:
			f.store_buffer(body)
			f.close()
			var ok := FileAccess.open(path + ".ok", FileAccess.WRITE)
			if ok != null:
				ok.store_string("1")
				ok.close()
				written = true
	if written:
		_paths[b] = path
	else:
		push_warning("exhibit video %d: download failed (%d, HTTP %d, %d bytes, %s)" % [b, result, code, body.size(), error_string(FileAccess.get_open_error())])
	_next_download()


func _process(delta: float) -> void:
	if _player == null:
		return
	var goal := 0.0
	# fade in only once real frames are coming (a file that would not open leaves a placeholder texture)
	if _bay >= 0 and _bay == _want and _player.is_playing() and _player.stream_position > 0.1:
		goal = 1.0
	_mix = move_toward(_mix, goal, delta / FADE)
	if _bay >= 0:
		ExhibitsBuild.set_video(_bay, _player.get_video_texture(), _mix)
	# faded out (or never in): move the player to the bay in focus, if it has a video ready
	if _mix <= 0.0 and _bay != _want:
		if _bay >= 0:
			_player.stop()
			ExhibitsBuild.set_video(_bay, null, 0.0)
		_bay = -1
		if _want >= 0 and _want < _paths.size() and _paths[_want] != "" and FileAccess.file_exists(_paths[_want]):
			var st := VideoStreamTheora.new()
			st.file = _paths[_want]
			_player.stream = st
			_player.play()
			_bay = _want
	if _bridge != null:
		_bridge.debugVideo = "%s:%.2f" % [str(_bay), _mix]

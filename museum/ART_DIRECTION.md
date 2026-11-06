# Museum after hours: art direction

The homepage of benadams.dev is a walk down one grand museum hall. Ben's
projects hang in bays along both walls, and the hall ends at a festival main
stage. A house track at 128 BPM runs the whole building's lighting.

The bar: it should read as a finished, current game, like a polished indie
title from this decade. It must not read as programmer art, a greybox, or a
90s render. Every surface has a material; every object sits on something; the
room is mostly dark and lit in pools.

## What made the first pass look 90s (don't repeat)

- Flat, uniform ambient fill: everything equally lit, nothing grounded.
- Perlin/cloud noise standing in for materials: blotchy brass, smoky walls.
- Hard unbevelled boxes and cylinders: specular highlights have no edges to catch.
- A thin monospace stroke font for neon.
- No bloom on emissives, thin aliased laser lines, and an unmotivated blue floor tint.

## Look

- **Light**: the room is dark, close to black between pools. Light comes
  from fixtures, and the camera sees where they land: floor pools, wall
  washes, art lit by its own fixtures, and beams in haze. Ambient sits just high
  enough that the architecture's silhouette reads. Contact darkening (baked AO,
  or AO maps in the textures) wherever things meet.
- **Colour**: every DMX fixture is red, from deep crimson (#5a0008) through red
  (#ff1a1a) to a white-hot core on strobe and blinder hits. Variety comes from
  intensity, beam width, motion and timing, never hue. The neutrals are warm:
  brass, dark walnut, cream plaster, black marble. The screenshots are shown
  true-colour; they are the only cool colours in the room.
- **Materials**: real CC0 scans (see ASSETS.md): polished black marble floor
  with a strong sheen, aged plaster or stone walls, dark walnut, brushed and
  patinated brass, red velvet, blackened steel truss. Albedo + normal +
  roughness at minimum, at a texel density that holds up at 1–2 m.
- **Form**: bevel every edge the camera gets near. Use mouldings (skirting,
  dado rail, cornice), fluted columns with bases and capitals, and frames with
  real profiles and a mat around each screenshot.
- **Post**: a filmic tonemap (AgX, or ACES if AgX isn't in compatibility), glow
  on emissives with a soft wide halo, slight vignette, and gentle contrast. It
  should look exposed for the highlights, the way a phone camera shoots a show.
- **Motion**: the camera glides with eased moves. The lights do the dancing.

## Constraints

- Renderer: gl_compatibility (WebGL2), on phones too. No depth-texture
  shaders, no SSAO/SSR/SDFGI/volumetrics, at most a couple of real Light3Ds.
  Fake beams, pools and spill with additive geometry; batch repeats with
  MultiMesh.
- Size: textures at 1K, 2K only for the floor. Use VRAM compression in the
  web export. Aim for under 15 MB for the .pck.
- Everything a fixture does is a pure function of song time (see
  `scripts/clock.gd`), so it stays locked to the music.
- Load time: in the browser a shader compiles at its first draw, on the main thread, and on
  Windows (ANGLE over Direct3D) a lit Godot spatial shader costs 2 to 5 s to compile cold. So
  nothing in the hall uses Godot's lit pipeline or a Light3D: every surface is `render_mode unshaded`
  and lights itself with `shaders/lite.gdshaderinc` (ambient, one spot, one omni, fed by
  `scripts/lite.gd`), and `scripts/warm.gd` compiles the remaining ~30 shader variants one frame at
  a time behind the page's poster. New surfaces should end with `lite_shade(...)`, not set
  ROUGHNESS / METALLIC / EMISSION, and new StandardMaterial3Ds should not be used. Time the
  build with `?museumperf` on the page (or `-- --perf` on the command line).

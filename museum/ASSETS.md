# Museum assets

CC0 needs no attribution, but the list is kept so anyone can find where an asset came from. Fonts are OFL 1.1 (licence text sits next to each font).

All maps are JPEG q85, 1024x1024 (floor 2048x2048), normals in OpenGL convention (ambientCG `NormalGL`, Poly Haven `nor_gl`), no conversion needed. Roughness, height, AO and metallic are single-channel greyscale. Files live in `museum/assets/textures/<set>/`.

## Textures

| Set | Source | Asset | URL | Licence | Maps |
|---|---|---|---|---|---|
| floor | ambientCG | Marble002 (2K) | https://ambientcg.com/a/Marble002 | CC0 | albedo, normal, roughness, height |
| wall (also ceiling, reuse at another scale) | ambientCG | PaintedPlaster017 | https://ambientcg.com/a/PaintedPlaster017 | CC0 | albedo, normal, roughness, height |
| wood_dark | ambientCG | Wood067 | https://ambientcg.com/a/Wood067 | CC0 | albedo, normal, roughness, height |
| brass | ambientCG | Metal048C (worn brass) | https://ambientcg.com/a/Metal048C | CC0 | albedo, normal, roughness, metallic, height |
| velvet | Poly Haven | velour_velvet | https://polyhaven.com/a/velour_velvet | CC0 | albedo, normal, roughness, ao, height |
| steel_black | ambientCG | Metal046B | https://ambientcg.com/a/Metal046B | CC0 | albedo, normal, roughness, metallic, height |
| stage_deck | Poly Haven | black_painted_planks | https://polyhaven.com/a/black_painted_planks | CC0 | albedo, normal, roughness, ao, height |
| rubber_black (stage cloth / rubber stand-in) | ambientCG | Rubber004 | https://ambientcg.com/a/Rubber004 | CC0 | albedo, normal, roughness, height |
| smudge (glass / polished-surface overlay) | ambientCG | Smear001 | https://ambientcg.com/a/Smear001 | CC0 | normal, roughness only |

## Fonts (`museum/assets/fonts/`)

| Use | Source | Font | URL | Licence | Files |
|---|---|---|---|---|---|
| Neon marquee | google/fonts | Sacramento | https://github.com/google/fonts/tree/main/ofl/sacramento | OFL 1.1 | `Sacramento-Regular.ttf`, `Sacramento-OFL.txt` (baked offline into `textures/sign_text_sdf.png` by `scripts/sign_bake_tool.gd`) |
| Brass plaques | google/fonts | Cinzel (variable, wght 400-900) | https://github.com/google/fonts/tree/main/ofl/cinzel | OFL 1.1 | `Cinzel-VariableFont_wght.ttf`, `Cinzel-OFL.txt` |

Cinzel ships only as a variable font; set the `wght` variation to about 600 for semibold (Godot `FontVariation.variation_opentype`).

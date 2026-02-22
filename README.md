# Side Quest Week 5: Meditative Camera Drift

## Group Members
- Suyao Liu, s226liu, student number: 21069335

## Description
This project is a reflective camera exploration experience in a world larger than the screen.  
The user drifts through a calm, animated environment and discovers hidden symbols scattered across the map. A minimap in the lower-right corner shows the current camera location and viewport, helping with navigation.

The design focuses on mood through slow camera motion, soft atmospheric particles, and subtle discovery feedback (symbol glow and ripple echoes).  
The interaction and implementation were inspired by class ideas on world space vs. screen space, camera transforms, and pacing through motion [1].

## Interaction Instructions
1. Open `index.html` in a web browser.
2. Move with `W A S D` or arrow keys.
3. Explore the full world and discover hidden symbols by moving near them.
4. Watch the status text (`Discovered symbols: X / 7`) and the minimap in the bottom-right:
   - Small dots = symbol locations
   - Bright dots = discovered symbols
   - Rectangle = current viewport in the full world
5. After all symbols are found, a win screen appears.
6. Click `Scatter Again` to hide the win screen, reset progress, and randomize symbol locations.

## Assets
No external image, audio, or downloadable asset files are used.  
All visuals are procedurally drawn with Canvas in `script.js`.

## References (ACM Format)
[1] GBDA 302 Course Team. 2026. *Week 5 - Part 2 (Course Handout PDF).* University of Waterloo.

[2] MDN Web Docs. 2026. *CanvasRenderingContext2D: translate() method.* Retrieved February 22, 2026 from https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/translate

[3] MDN Web Docs. 2026. *Canvas API.* Retrieved February 22, 2026 from https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

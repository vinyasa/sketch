import os
import re

tex_dir = r'd:\Antigravity Dev\Sketch\public\textures'
for file in os.listdir(tex_dir):
    if file.endswith('.svg'):
        with open(os.path.join(tex_dir, file), 'r') as f:
            content = f.read()
            
        content = re.sub(r'baseFrequency="[^"]+"', 'baseFrequency="0.004 0.08"', content)
        content = re.sub(r'numOctaves="\d+"', 'numOctaves="3"', content)
        content = re.sub(r'0 0 0 [\d\.]+ 0', '0 0 0 0.5 0', content)
        
        with open(os.path.join(tex_dir, file), 'w') as f:
            f.write(content)

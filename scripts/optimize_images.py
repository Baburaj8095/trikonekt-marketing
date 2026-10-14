import os
from PIL import Image

assets_dir = r"frontend\src\assets"

images_to_optimize = [
    ("wishing_gowri_ganesha.png", "wishing_gowri_ganesha.webp", 1200),
    ("wishing_connect_grow.png", "wishing_connect_grow.webp", 1200),
    ("homepage_banner.png", "homepage_banner.webp", 1200),
    ("thailand.jpg", "thailand.webp", 1000),
    ("kerala.jpg", "kerala.webp", 1000),
    ("himalayan_temple_bg.jpg", "himalayan_temple_bg.webp", 1000),
    ("ecommerce.jpg", "ecommerce.webp", 800),
    ("tri-banner.png", "tri-banner.webp", 1200),
    ("lucky-draw-img.png", "lucky-draw-img.webp", 1000),
    ("prime_deal.png", "prime_deal.webp", 800),
    ("spin_deal.png", "spin_deal.webp", 800),
]

for src_name, dst_name, max_dim in images_to_optimize:
    src_path = os.path.join(assets_dir, src_name)
    dst_path = os.path.join(assets_dir, dst_name)
    if not os.path.exists(src_path):
        print(f"Skipping {src_name} (not found)")
        continue
    
    orig_size = os.path.getsize(src_path)
    with Image.open(src_path) as img:
        img = img.convert("RGB")
        w, h = img.size
        if max(w, h) > max_dim:
            if w > h:
                new_w = max_dim
                new_h = int(h * (max_dim / w))
            else:
                new_h = max_dim
                new_w = int(w * (max_dim / h))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        img.save(dst_path, "WEBP", quality=80, method=6)
    
    new_size = os.path.getsize(dst_path)
    savings = (1 - (new_size / orig_size)) * 100
    print(f"Converted {src_name} ({orig_size/1024:.1f} KB) -> {dst_name} ({new_size/1024:.1f} KB) [{savings:.1f}% reduction]")

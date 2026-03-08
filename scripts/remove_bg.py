"""
MusicGacha - Pack Image Background Remover
緑色クロマキー背景を透過に変換するスクリプト (Pillow only, no numpy)
"""

from PIL import Image
import sys
import os

# 入力/出力のマッピング
PACK_IMAGES = {
    "jpop": r"C:\Users\rwjd7\.gemini\antigravity\brain\2364b463-0c29-4d8a-afb2-25e7f08835ee\pack_jpop_raw_1772923773189.png",
    "kpop": r"C:\Users\rwjd7\.gemini\antigravity\brain\2364b463-0c29-4d8a-afb2-25e7f08835ee\pack_kpop_raw_1772923791021.png",
    "vocaloid": r"C:\Users\rwjd7\.gemini\antigravity\brain\2364b463-0c29-4d8a-afb2-25e7f08835ee\pack_vocaloid_raw_1772923810590.png",
    "anime": r"C:\Users\rwjd7\.gemini\antigravity\brain\2364b463-0c29-4d8a-afb2-25e7f08835ee\pack_anime_raw_1772923828175.png",
    "hiphop": r"C:\Users\rwjd7\.gemini\antigravity\brain\2364b463-0c29-4d8a-afb2-25e7f08835ee\pack_hiphop_raw_1772923859582.png",
    "idol": r"C:\Users\rwjd7\.gemini\antigravity\brain\2364b463-0c29-4d8a-afb2-25e7f08835ee\pack_idol_raw_1772923878354.png",
    "western": r"C:\Users\rwjd7\.gemini\antigravity\brain\2364b463-0c29-4d8a-afb2-25e7f08835ee\pack_western_raw_1772923893928.png",
    "top200": r"C:\Users\rwjd7\.gemini\antigravity\brain\2364b463-0c29-4d8a-afb2-25e7f08835ee\pack_top200_raw_1772923915158.png",
}

OUTPUT_DIR = r"c:\dev\musicgacha\assets"


def remove_green_background(input_path, output_path, green_threshold=80, tolerance=60):
    """
    緑色クロマキー背景を透過に変換 (Pillow only)
    """
    img = Image.open(input_path).convert("RGBA")
    pixels = img.load()
    width, height = img.size
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            # 緑色判定: Gが十分高く、R/Bより十分大きい
            is_green = (
                g > green_threshold and
                g > r + tolerance and
                g > b + tolerance
            )
            
            if is_green:
                # 緑の強さに基づいてアルファを計算
                total = r + g + b + 1
                green_ratio = g / total
                
                if green_ratio > 0.5:
                    # 強い緑 → 完全透明
                    pixels[x, y] = (r, g, b, 0)
                else:
                    # エッジ部分 → 半透明 + spill suppression
                    edge_alpha = int(max(0, min(255, 255 * (1.0 - (green_ratio - 0.33) / 0.17))))
                    max_rb = max(r, b)
                    new_g = min(g, max_rb)
                    pixels[x, y] = (r, new_g, b, edge_alpha)
    
    img.save(output_path, "PNG")
    print(f"  OK: {output_path}")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("MusicGacha Pack Background Remover")
    print("=" * 50)
    
    for pack_id, input_path in PACK_IMAGES.items():
        output_path = os.path.join(OUTPUT_DIR, f"pack-{pack_id}.png")
        print(f"\nProcessing: {pack_id}")
        
        if not os.path.exists(input_path):
            print(f"  ERROR: Input not found: {input_path}")
            continue
        
        try:
            remove_green_background(input_path, output_path)
        except Exception as e:
            print(f"  ERROR: {e}")
    
    print("\n" + "=" * 50)
    print("Done! All pack images processed.")


if __name__ == "__main__":
    main()

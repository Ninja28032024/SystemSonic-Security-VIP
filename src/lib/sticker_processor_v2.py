#!/usr/bin/env python3
"""
Script para processar figurinhas ACHATADAS (STRETCH)
Redimensiona a imagem para 512x512 ignorando a proporção original.
"""

import sys
import os
import json
from PIL import Image

def processar_imagem_achatada(input_path, output_path, pack_name, author):
    """
    Redimensiona a imagem para 512x512 ignorando a proporção (achata a imagem)
    """
    try:
        # Abrir a imagem
        img = Image.open(input_path)
        
        # Converter para RGBA para garantir transparência
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Redimensionar FORÇADO para 512x512 (ignora proporção, gera o efeito "achatado")
        img_resized = img.resize((512, 512), Image.Resampling.LANCZOS)
        
        # Salvar como WebP
        img_resized.save(output_path, 'WEBP', quality=90, method=6)
        
        print(json.dumps({
            "status": "success",
            "message": "Figurinha achatada processada com sucesso",
            "output": output_path
        }))
        
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": str(e)
        }))
        sys.exit(1)

def processar_video_achatado(input_path, output_path):
    """
    Processa vídeo para figurinha achatada usando ffmpeg (ignora aspect ratio)
    """
    import subprocess
    
    try:
        # Comando FFmpeg para converter vídeo em WebP animado ACHATANDO para 512x512
        # O filtro 'scale=512:512' sem o 'force_original_aspect_ratio' faz o stretch automático
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-vcodec', 'libwebp',
            '-vf', 'scale=512:512,setsar=1,fps=15',
            '-loop', '0',
            '-preset', 'default',
            '-an',
            '-vsync', '0',
            '-ss', '00:00:00.0',
            '-t', '00:00:09.5',
            output_path,
            '-y'
        ]
        
        subprocess.run(cmd, check=True, capture_output=True)
        
        print(json.dumps({
            "status": "success",
            "message": "Vídeo achatado processado com sucesso",
            "output": output_path
        }))
        
    except subprocess.CalledProcessError as e:
        print(json.dumps({
            "status": "error",
            "message": f"Erro ao processar vídeo: {e.stderr.decode()}"
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({
            "status": "error",
            "message": "Uso: python3 sticker_processor_v2.py <input> <output> <type> [pack_name] [author]"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    media_type = sys.argv[3]
    pack_name = sys.argv[4] if len(sys.argv) > 4 else "SystemSonic"
    author = sys.argv[5] if len(sys.argv) > 5 else "Figurinha Achatada"
    
    if media_type == "image":
        processar_imagem_achatada(input_path, output_path, pack_name, author)
    elif media_type == "video":
        processar_video_achatado(input_path, output_path)
    else:
        print(json.dumps({
            "status": "error",
            "message": f"Tipo de mídia não suportado: {media_type}"
        }))
        sys.exit(1)

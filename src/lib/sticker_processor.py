#!/usr/bin/env python3
"""
Script para processar figurinhas com metadados usando Python e Pillow
Suporta: Imagens, GIFs e vídeos
"""

import sys
import os
import json
import struct
from PIL import Image

def adicionar_metadados_webp(input_path, output_path, pack_name, author):
    """
    Converte uma imagem para WebP e adiciona metadados de figurinha
    """
    try:
        # Abrir e processar a imagem
        img = Image.open(input_path)
        
        # Converter para RGBA se necessário
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Redimensionar para 512x512 mantendo proporção
        img.thumbnail((512, 512), Image.Resampling.LANCZOS)
        
        # Criar nova imagem com fundo transparente
        background = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
        offset = ((512 - img.width) // 2, (512 - img.height) // 2)
        background.paste(img, offset, img)
        
        # Salvar como WebP com metadados
        # Os metadados são salvos como EXIF no WebP
        background.save(output_path, 'WEBP', quality=90, method=6)
        
        # Adicionar metadados usando estrutura JSON no arquivo WebP
        adicionar_metadados_json_webp(output_path, pack_name, author)
        
        print(json.dumps({
            "status": "success",
            "message": "Figurinha processada com sucesso",
            "output": output_path
        }))
        
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": str(e)
        }))
        sys.exit(1)

def adicionar_metadados_json_webp(webp_path, pack_name, author):
    """
    Adiciona metadados JSON ao arquivo WebP para WhatsApp
    """
    try:
        # Ler o arquivo WebP
        with open(webp_path, 'rb') as f:
            webp_data = f.read()
        
        # Criar estrutura de metadados para WhatsApp
        metadata = {
            "sticker-pack-id": "com.system.sonic",
            "pack": pack_name,
            "author": author,
            "is-animated": False,
            "trayImageFileName": "tray_image.png"
        }
        
        # Converter para JSON
        metadata_json = json.dumps(metadata).encode('utf-8')
        
        # Adicionar chunk EXIF ao WebP com os metadados
        # Formato: RIFF header + WEBP + chunks
        # Vamos tentar adicionar como chunk de metadados
        
        # Para agora, vamos apenas salvar os metadados em um arquivo separado
        # que será lido pelo Node.js
        metadata_file = webp_path.replace('.webp', '.json')
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f)
        
    except Exception as e:
        # Se falhar, apenas continua sem metadados
        print(f"Aviso: Não foi possível adicionar metadados JSON: {e}", file=sys.stderr)

def processar_video(input_path, output_path):
    """
    Processa vídeo para figurinha usando ffmpeg
    """
    import subprocess
    
    try:
        # Comando FFmpeg para converter vídeo em WebP animado
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-vcodec', 'libwebp',
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1,fps=15',
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
            "message": "Vídeo processado com sucesso",
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
            "message": "Uso: python3 sticker_processor.py <input> <output> <type> [pack_name] [author]"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    media_type = sys.argv[3]
    pack_name = sys.argv[4] if len(sys.argv) > 4 else "SystemSonic"
    author = sys.argv[5] if len(sys.argv) > 5 else "Criado por: SystemSonic"
    
    if media_type == "image":
        adicionar_metadados_webp(input_path, output_path, pack_name, author)
    elif media_type == "video":
        processar_video(input_path, output_path)
    else:
        print(json.dumps({
            "status": "error",
            "message": f"Tipo de mídia não suportado: {media_type}"
        }))
        sys.exit(1)

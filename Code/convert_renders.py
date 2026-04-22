import os
import subprocess

# Paths
script_dir = os.path.dirname(__file__)
workspace_dir = os.path.dirname(script_dir)
renders_dir = os.path.join(workspace_dir, "renders")
output_dir = os.path.join(workspace_dir, "Code", "main", "ressources")

# Create output directory if it doesn't exist
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Settings
framerate = 30 # Adjust this to match your Blender render settings
crf = 23 # Constant Rate Factor (18-28 is a good range. Lower is better quality but bigger file size)

def convert_to_video():
    # Iterate through all folders in the renders directory
    for folder_name in os.listdir(renders_dir):
        folder_path = os.path.join(renders_dir, folder_name)
        
        # Check if it's a directory and doesn't start with a dot
        if os.path.isdir(folder_path) and not folder_name.startswith('.'):
            print(f"Processing folder: {folder_name}...")
            
            output_file = os.path.join(output_dir, f"{folder_name}.mp4")
            output_file_rev = os.path.join(output_dir, f"{folder_name}_reverse.mp4")
            
            # The frames are named like {folder_name}_0001.png, {folder_name}_0002.png, etc.
            # %04d means a 4-digit padded number. Adjust the extension if they are .jpg
            input_pattern = os.path.join(folder_path, f"{folder_name}_%04d.png")
            
            # FFmpeg command for web-optimized H.264 MP4
            command = [
                "ffmpeg",
                "-y", # Overwrite output if exists
                "-framerate", str(framerate),
                "-i", input_pattern,
                "-c:v", "libx264",     # Use H.264 codec
                "-crf", str(crf),      # Quality setting
                "-preset", "slow",     # Slower encoding = better compression
                "-pix_fmt", "yuv420p", # Essential pixel format for web/HTML5 compatibility
                "-movflags", "+faststart", # Moves metadata to the start of the file for instant web playback
                output_file
            ]
            
            # Additional command to bake the reverse video
            command_rev = [
                "ffmpeg",
                "-y",
                "-i", output_file,     # Taking the generated mp4 to reverse it
                "-vf", "reverse",      # Reverse filter
                "-c:v", "libx264",
                "-crf", str(crf),
                "-preset", "slow",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                output_file_rev
            ]
            
            try:
                # Run the FFmpeg command
                subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
                subprocess.run(command_rev, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
                print(f"Successfully created: {output_file} & {output_file_rev}")
            except subprocess.CalledProcessError as e:
                print(f"Error processing {folder_name}. Ensure frames are named sequentially (e.g., {folder_name}_0001.png).")
            except FileNotFoundError:
                print("Error: FFmpeg is not installed or not in your system PATH.")
                break

    print("Conversion complete!")

if __name__ == "__main__":
    convert_to_video()

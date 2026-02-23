# Pacefors <img src="static/SmugTime.webp" alt="ForsenHoppedin" />

Pacefors is a web app that tracks Forsens Minecraft Speedruns with split/death data using text recognition (OCR) from his streams.  
Data is automatically collected and pushed using GitHub Actions, and the app is hosted on GitHub Pages.

## Website
The frontend small vanilla JS web app that parses the `stripped_runs.json` data created by the scripts below and visualizes it.  
It also has a calculator tool that statistically estimates the chance of hitting certain splits under a target time by a chosen date.

## Data Collection

Data is collected using a python script (`run.py`) that either runs on a VOD or on the live stream, and writes the raw data to JSON files.  
GitHub Actions is used to manually (and automatically, though this is not implemented yet) run the script and push the output JSON files to the repository.

### Scripts (`/python`)
#### `run.py`  
Main data collection script that uses streamlink to get the HLS stream, 
streams it through ffmpeg at 1 fps and uses EasyOCR to extract the relevant information 
(Timer, Advancements, Death Msg and Ninjabrain status).  
The script has two modes, it can either be run with a VOD and starting timestamp and write to `outout_mmmdd.json`, 
or directly on the live stream to `live_yyyymmdd-hhmmss.json`.

#### `merge_outputs.py`  
Processes all the output JSON files through 3 stages and writes the final output to `stripped_runs.json`, which is used by the website.
1. `raw_data` -> `filtered_data` - Removes all entries with invalidly formatted timers and tries its best to remove timers that are a valid format but has the wrong time.
2. `filtered_data` -> `runs` - Turns the stream of data into individual runs whenever the timer resets, containing every data point for that run.
3. `runs` -> `stripped_runs` - Removes tha data points and replaces them with the time of each split, and death reason, plus a list to VOD timestamps every 5 seconds IGT for seeking.

#### `check_if_forsen_is_live.py`  
Self-explanatory, checks if Forsen is live and if hes in the Minecraft category  
Returns exit code `0` if he's offline, `1` if hes NOT playing Minecraft, and `2` if he's live and playing Minecraft.  
Also has a `--wait` option that hangs the script if he's live not in the Minecraft category, and waits until he starts playing Minecraft, used by the GitHub Workflow.

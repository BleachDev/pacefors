# Pacefors <img src="static/forsenHoppedin.webp" alt="ForsenHoppedin" />

Pacefors is a web app that tracks Forsens Minecraft Speedruns with split/death data using text recognition (OCR) from his streams.  
Data is automatically collected and pushed using GitHub Actions, and the app is hosted on GitHub Pages.

### Website
The frontend small vanilla JS web app that parses the `stripped_runs.json` data created by the scripts below and visualizes it.  
It also has a calculator tool that statistically estimates the chance of hitting certain splits under a target time by a chosen date.

### Scripts (`/python`)
- `run.py`  
Main data collection script that uses streamlink to get the HLS stream, 
streams it through ffmpeg at 1 fps and uses EasyOCR to extract the relevant information 
(Timer, Advancements, Death Msg and Ninjabrain status).  
The script has two modes, it can either be run with a VOD and starting timestamp and write to `outout_mmmdd.json`, 
or directly on the live stream to `live_yyyymmdd-hhmmss.json`.  


- `merge_outputs.py`  
Processes all the output JSON files through 3 stages:  
1. `raw_data` -> `filtered_data` - Removes all entries with invalidly formatted timers and tries its best to remove timers that are a valid format but has the wrong time.
2. `filtered_data` -> `runs` - Turns the stream of data into individual runs whenever the timer resets, containing every data point for that run.
3. `runs` -> `stripped_runs` - Removes tha data points and replaces them with the time of each split, and death reason, plus a list to VOD timestamps every 5 seconds IGT for seeking.


- `check_if_forsen_is_live.py`  
Self-explanatory, checks if Forsen is live and if hes in the Minecraft category  
Returns exit code `0` if he's offline, `1` if hes NOT playing Minecraft, and `2` if he's live and playing Minecraft.  
Also has a `--wait` option that hangs the script if he's live not in the Minecraft category, and waits until he starts playing Minecraft, used by the GitHub Workflow.


### GitHub Actions
- `live-scheduled.yml`  
Scheduled to run every day at 15:30 UTC, checks if Forsen is live, and if so waits until he's in the Minecraft category,  
then runs `run.py live` to capture the live stream until it ends,  
while its running every 5 minutes it runs `merge_outputs.py` and pushes the updated data to the repo, so the website can update in (almost) real-time.  



- `vod-scheduled.yml`  
TODO: Not implemented yet, but should run at midnight UTC every day, check if there are any live files,  
and if so start a full recapture of the VOD since the live capture is not perfect, uploads it and deletes the old live data.
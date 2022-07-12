#!/usr/bin/env bash

# Get a (hopefully active) SSH auth socket
# This assumes an ssh-agent is running and has identities loaded
export SSH_AUTH_SOCK=$(ls -rt1 /tmp/ssh*/* | tail -1)

DT=$(date)
echo "Started sync and render at $DT"
echo "SSH_AUTH_SOCK: $SSH_AUTH_SOCK"

# User configuration
SSH_USERNAME=storegga
# Minecraft world data folder
SNAPSHOT_DIR=/nfs/ssda/minecraft-neoliberal/current-server
MINECRAFT_MAP_FOLDER=/media/ssd2-linux/minecraft-neoliberal
# Path to sporfbase-markers repo
MARKERS_FOLDER=/media/ssd2-linux/minecraft-neoliberal/sporfbase-markers

# Derived from above
MINECRAFT_MAP_RENDER_FOLDER=$MINECRAFT_MAP_FOLDER/minecraft-map
MARKERS_WIKI_FOLDER=$MARKERS_FOLDER/wiki

function render_neoliberal {
    echo "Starting render"
    /usr/local/bin/mapcrafter -c $MARKERS_FOLDER/render.conf -j 4
    echo "Render complete, rcode: $?"
}

function sync_controlled {
    echo "[sync_controlled] Starting"
    echo "[sync_controlled] ARGS: $1 $2"
    MAP_NAME=$1
    # Collect updated files
    # This includes anything updated in the last 24 hours which should more than cover everything included in the last render
    cd $MINECRAFT_MAP_RENDER_FOLDER;
    echo "[sync_controlled] Pushing render for ${MAP_NAME}"
    echo "Started collecting newly updated files at $(date)"
    find ./$MAP_NAME -mtime -1 | sed -E "s/^\.\/$MAP_NAME/\./" > /tmp/$MAP_NAME
    echo "Started sync to carmar at $(date)"
    # Sync map
    cd $MINECRAFT_MAP_RENDER_FOLDER;
    rsync -zar \
	--files-from=/tmp/$MAP_NAME \
	--update --omit-dir-times --chown=$SSH_USERNAME:mapcraft --info=progress2 \
	$MAP_NAME \
	$SSH_USERNAME@sporfbase.com:/home/$SSH_USERNAME/proxy/minecraft-map/$MAP_NAME
}

# Update snapshot of minecraft world data
rsync -zav --update --exclude 'CoreProtect/database.db' $SSH_USERNAME@sporfbase.com:/opt/minecraft/neoliberal $SNAPSHOT_DIR 

# Render mapcrafter map
cd $MINECRAFT_MAP_FOLDER;
{ render_neoliberal 2>&1; } | grep -v 'Out dated chunk' | grep -v 'No biome data' | grep -v "Y out of chunk"

# Upload map
sync_controlled "Heartland"
sync_controlled "Heartland_topdown"

# Parse markers from mediawiki and update marker files
cd $MARKERS_WIKI_FOLDER
./parse_wiki_markers.js
cp markers_catenated.js ../../minecraft-map/markers.js

# Sync marker images
cd $MARKERS_FOLDER
cp ./icons/*svg ../minecraft-map/static/markers

# Sync marker data files and browser map config data
cd $MINECRAFT_MAP_RENDER_FOLDER
scp ./markers.js $SSH_USERNAME@sporfbase.com:/home/$SSH_USERNAME/proxy/minecraft-map/markers.js
echo "markers.js: $?"
scp ./config.js $SSH_USERNAME@sporfbase.com:/home/$SSH_USERNAME/proxy/minecraft-map/config.js
echo "config.js: $?"
rsync -r ./static/markers $SSH_USERNAME@sporfbase.com:/home/$SSH_USERNAME/proxy/minecraft-map/static
echo "./static/markers: $?"

# Done!
DT=$(date)
echo "Completed sync and render at $DT"

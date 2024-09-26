<script>
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';

	let map;
	let marker;
	let socket;
	let journeyPath = []; // Initialize an array to store the journey path coordinates
	let activeSpeed = 1;
	let isJourneyStarted = false; // Track if the journey has started
	let isJourneyStopped = false; // Track if the journey is paused/stopped

	// Initialize Mapbox
	mapboxgl.accessToken =
		'pk.eyJ1IjoiZGFuaWVsbWVuZHM5OSIsImEiOiJjbTFmOGp1c3ExZ293MnFzYnl0aTBncWgzIn0.xwJMAyS7W2f7QiB5I4-bQw';

	onMount(() => {
		// Initialize the map
		map = new mapboxgl.Map({
			container: 'map',
			style: 'mapbox://styles/mapbox/satellite-streets-v12',
			center: [-8.6203, 41.1895], // Default center (Guifões CP)
			zoom: 16
		});

		map.on('load', () => {
			map.addSource('route', {
				type: 'geojson',
				data: {
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'LineString',
						coordinates: journeyPath
					}
				}
			});

			// Layer that displays the train path
			map.addLayer({
				id: 'route',
				type: 'line',
				source: 'route',
				layout: {
					'line-join': 'round',
					'line-cap': 'round'
				},
				paint: {
					'line-color': '#D22B2B',
					'line-width': 4
				}
			});
		});

		marker = new mapboxgl.Marker().setLngLat([-9.1393, 38.7223]).addTo(map);

		// Connect to WebSocket server
		socket = new WebSocket('ws://localhost:8080');

		// Handle location updates
		socket.onmessage = (event) => {
			const location = JSON.parse(event.data);

			// Update marker position
			marker.setLngLat([location.lng, location.lat]);
			map.flyTo({ center: [location.lng, location.lat], essential: true });

			// Update the journey path and map layer
			journeyPath.push([location.lng, location.lat]); // Add new coordinates to the journey path
			map.getSource('route').setData({
				type: 'Feature',
				properties: {},
				geometry: {
					type: 'LineString',
					coordinates: journeyPath // Update the coordinates in the GeoJSON source
				}
			});
		};
	});

	function startJourney(event) {
		event.preventDefault(); // Prevent default form action if in a form
		event.stopPropagation(); // Stop the event from bubbling up

		socket.send(
			JSON.stringify({
				jsonrpc: '2.0',
				method: 'startJourney',
				params: { delaySeconds: 1 },
				id: 1
			})
		);
		isJourneyStarted = true;
		isJourneyStopped = false;
	}

	function stopOrContinueJourney(event) {
		event.preventDefault();
		event.stopPropagation();

		if (isJourneyStopped) {
			// Continue the journey
			socket.send(
				JSON.stringify({
					jsonrpc: '2.0',
					method: 'continueJourney',
					id: 2
				})
			);
			isJourneyStopped = false;
		} else {
			// Stop the journey
			socket.send(
				JSON.stringify({
					jsonrpc: '2.0',
					method: 'stopJourney',
					id: 3
				})
			);
			isJourneyStopped = true;
		}
	}

	function changeSpeed(speed) {
		activeSpeed = speed;
		socket.send(
			JSON.stringify({
				jsonrpc: '2.0',
				method: 'setReplaySpeed',
				params: { speed },
				id: 2
			})
		);
	}
</script>

<div>
	<div class="controls">
		<label>
			{#if !isJourneyStarted}
				<button on:click={(event) => startJourney(event)}>Start</button>
			{:else}
				<button on:click={(event) => stopOrContinueJourney(event)}>
					{isJourneyStopped ? 'Continue' : 'Stop'}
				</button>
			{/if}
		</label>

		{#if isJourneyStarted}
			<label
				>Speed x1<button class:active={activeSpeed === 1} on:click={() => changeSpeed(1)}>X1</button
				></label
			>

			<label
				>Speed x2<button class:active={activeSpeed === 2} on:click={() => changeSpeed(2)}>X2</button
				></label
			>

			<label
				>Speed x5<button class:active={activeSpeed === 5} on:click={() => changeSpeed(5)}>X5</button
				></label
			>
		{/if}
	</div>

	<div id="map"></div>
</div>

<style>
	.controls {
		background-color: #fff;
		padding: 30px;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 30px;
	}

	.controls label {
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 10px;
	}
	button {
		width: 80px;
		border-radius: 50%;
		aspect-ratio: 1/1;
		border: 1px solid #000;
		background-color: transparent;
		cursor: pointer;
	}

	.controls label button:hover:not(.active) {
		background-color: rgba(13, 99, 22, 0.2);
		color: #fff;
	}

	.active {
		color: #fff;
		background-color: green;
	}

	#map {
		width: 100%;
		height: 800px;
	}
</style>

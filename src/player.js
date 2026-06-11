Namespace('Sequencer').Engine = (function() {
	let _qset = null;
	let _$board = null;
	const _tiles = [];    // Array of tile object information
	let _tilesInVertOrder = [];    // Array of tiles in top to bottom visual order
	let _numTiles = 0;     // Total number of tiles in the qset
	let _ids = [];    // Array which holds random numbers for the tile Id's
	let _tilesInSequence = 0;     // Count for the number of tiles in the OrderArea div
	const _sequence = [];  // Order of the submitted tiles
	let _attempts = 0;     // Number of tries the current user has made
	const _playDemo = true;  // Boolean for demo on/off
	let _freeAttempts = 0;     // Number of attempts before the penalty kicks in
	let _practiceMode = false; // true = practice mode, false = assessment mode
	let _isListView = false; // true = organized grid/list view, false = jumbled pile view

	const _keyboardInstructions = 'Use Tab to navigate between tiles. ' +
		'Use Arrow keys to move tiles in/out of sequence and reorder. ' +
		'Press Enter to view clues. ' +
		'Press Space to submit when ready. ' +
		'Press Ctrl+V (or Cmd+V) to toggle between jumbled pile and organized grid view.';

	// SortableJS instances
	let _dragSortable = null;
	let _orderSortable = null;
	// Score tracking
	let highestScore = 0;
	let _highestSequence = [];

	// Called by Materia.Engine when your widget Engine should start the user experience.
	const start = function(instance, qset, version) {
		if (version == null) { version = '1'; }
		if (qset.items[0].items) {
			qset.items = qset.items[0].items;
		}
		_qset = qset;

		_freeAttempts = _qset.options.freeAttempts || 10;

		// Determine the play modes
		if (_qset.options.practiceMode != null) { _practiceMode = _qset.options.practiceMode; }

		if (_playDemo) {
			_startDemo();
		} else {
			$('.fade').removeClass('active');
		}

		_drawBoard(instance.name);

		// Set player height.
		return Materia.Engine.setHeight();
	};

	// Generate IDs for tiles - frontend identifiers
	const _makeRandomIdForTiles = function(needed) {
		const idArray = [];
		let i = 0;
		while (i <= needed) {
			var newNum = Math.floor((Math.random() * 200) + 1);
			if (idArray.indexOf(newNum) === -1) { idArray[i] = newNum; } else { i--; }
			i++;
		}
		return idArray;
	};

	// Create tile objects from qset
	const _makeTiles = function(items) {
		_ids = _makeRandomIdForTiles(items.length);
		let i = 0;

		for (var tile of Array.from(items)) {
			_numTiles++;
			_tiles[_ids[i]] = {
				id: _ids[i],
				qid: tile.id,
				name: tile.questions[0].text,
				clue: tile.options.description,
				order: i 
			};
			i++;
		}
		return _tiles;
	};

	// Draw the main board 
	var _drawBoard = function(title) {
		const theTiles = _makeTiles(_qset.items);
		const tBoard = _.template($('#t-board').html());

		_$board = $(tBoard({
			title: title,
			tiles: theTiles,
			score: "0%",
			penalty: ~~_qset.options.penalty,
			freeAttempts: _freeAttempts,
			keyboardInstructions: 'Keyboard instructions: ' + _keyboardInstructions
		}));

		$('body').append(_$board);

		// Handle practice mode display
		if (_practiceMode) {
			$('#attempts-info').addClass('hidden');
		} else if (_freeAttempts != null) {
			$('#practiceMode-info').addClass('hidden');
		} else {
			$('#attempts-info').addClass('hidden');
			$('#practiceMode-info').addClass('hidden');
		}

		_setupSortableJS();
		_setupEventListeners();

		// Initialize view mode (start with pile view)
		const dragContainer = document.getElementById('dragContainer');
		const listViewBtn = document.querySelector('.list-view-btn');
		dragContainer.classList.add('pile-view');
		listViewBtn.textContent = '≡ List view';
		listViewBtn.setAttribute('aria-label', 'Switch to organized grid view');

		_randomizeTilePositions();
		_updateWraparoundAriaLabel();
		_setAriaLabelsForTiles();
	};

	// SortableJS
	var _setupSortableJS = function() {
		const dragContainer = document.getElementById('dragContainer');
		const orderArea = document.getElementById('orderArea');
			// Create SortableJS instance for drag container (the unsorted tiles)
	_dragSortable = Sortable.create(dragContainer, {
		group: {
			name: 'tiles',
			pull: true,
			put: true
		},
		animation: 150,
		sort: false, // Don't sort within the drag container
		draggable: '.tile',
		ghostClass: 'sortable-ghost',
		chosenClass: 'sortable-chosen',
		dragClass: 'sortable-drag',
		onAdd: _handleTileAdded,
		onRemove: _handleTileRemoved,
		onEnd: _handleDragEnd,
		onStart: _handleDragStart,
		onChoose: _handleDragChoose
	});

			// Create SortableJS instance for order area (sorted tiles)
	_orderSortable = Sortable.create(orderArea, {
		group: {
			name: 'tiles',
			pull: true,
			put: true
		},
		animation: 150,
		sort: true, // Allow sorting within the order area
		draggable: '.tile',
		ghostClass: 'sortable-ghost',
		chosenClass: 'sortable-chosen',
		dragClass: 'sortable-drag',
		scroll: true, // auto-scrolling
		scrollSensitivity: 30, // Distance from edge to trigger scroll
		scrollSpeed: 10, // Scroll speed in pixels per frame
		onAdd: _handleTileAdded,
		onRemove: _handleTileRemoved,
		onUpdate: _handleSequenceUpdate,
		onEnd: _handleDragEnd,
		onMove: _handleDragMove,
		onStart: _handleDragStart,
		onChoose: _handleDragChoose,
		onChange: _handleDragChange
	});
	};

	// Tile added to order area
	var _handleTileAdded = function(evt) {
		const tileId = parseInt(evt.item.getAttribute('data-id'), 10);
		const newIndex = evt.newIndex;
		const placedTile = evt.item;
		placedTile.classList.remove('sortable-ghost');
		placedTile.style.background = '';
		placedTile.style.opacity = '';
		placedTile.style.border = '';
		placedTile.style.boxShadow = '';
		// Update sequence array
		_sequence.splice(newIndex, 0, tileId);
		_tilesInSequence = _sequence.length;
		// Update position indicators and ui for all tiles in sequence
		_updatePositionIndicators();
		_updateOrderInstructions();
		_setAriaLabelsForTiles();
		// Check if tiles are sequenced
		if (_tilesInSequence === _numTiles) {
			_tilesSequenced();
		}

		_assistiveStatusUpdate(_tiles[tileId].name + ' added to sequence. ' + _tilesInSequence + ' of ' + _numTiles + ' tiles sorted.');
	};

	// Handle tile being removed from order area
	var _handleTileRemoved = function(evt) {
		const tileId = parseInt(evt.item.getAttribute('data-id'), 10);
		const oldIndex = evt.oldIndex;
		// Update sequence array
		_sequence.splice(oldIndex, 1);
		_tilesInSequence = _sequence.length;
		// Update position indicators for remaining tiles
		_updatePositionIndicators();
		_updateOrderInstructions();
		_setAriaLabelsForTiles();
		// Disable submit if not all tiles are sequenced
		if (_tilesInSequence < _numTiles) {
			$('#submit').prop('disabled', true);
			$('#submit').removeClass('enabled');
		}
		_assistiveStatusUpdate(_tiles[tileId].name + ' removed from sequence. ' + _tilesInSequence + ' of ' + _numTiles + ' tiles sorted.');
	};

	// Handle sequence reordering
	var _handleSequenceUpdate = function(evt) {
		// Rebuild sequence array from DOM order
		_updateSequenceFromDOM();
		_updatePositionIndicators();
		_setAriaLabelsForTiles();
	};

	// Handle drag movement for auto-scrolling
	var _handleDragMove = function(evt) {
		const orderArea = document.getElementById('orderArea');
		const rect = orderArea.getBoundingClientRect();
		const mouseY = evt.clientY;
		const scrollThreshold = 50; // Distance from edge to trigger scroll
		const scrollSpeed = 5; // Pixels to scroll per frame
		// Check if mouse is near the bottom edge of the order area
		if (mouseY > rect.bottom - scrollThreshold && mouseY < rect.bottom) {
			// Scroll down
			orderArea.scrollTop += scrollSpeed;
		}
		// Check if mouse is near the top edge of the order area
		else if (mouseY < rect.top + scrollThreshold && mouseY > rect.top) {
			// Scroll up
			orderArea.scrollTop -= scrollSpeed;
		}
	};
	// Handle drag start
	var _handleDragStart = function(evt) {
		// Add drag-over class to order area when dragging starts
		const orderArea = document.getElementById('orderArea');
		orderArea.classList.add('sortable-drag-over');
		
		// IS GHOST ELEMENT VISIBLE CHECK
		console.log('Drag start, ghost element should be visible');
	};
	// Handle drag choose (when tile is selected for dragging)
	var _handleDragChoose = function(evt) {
		// Add visual feedback that dragging is about to start
		const orderArea = document.getElementById('orderArea');
		orderArea.classList.add('sortable-drag-over');
	};

	// Handle drag change (when dragging over different positions)
	var _handleDragChange = function(evt) {
		// check
		console.log('Drag change detected, ghost element should be visible');
		// Force ghost element to be visible
		const ghostElements = document.querySelectorAll('.sortable-ghost');
		ghostElements.forEach(function(ghost) {
			ghost.style.display = 'flex';
			ghost.style.visibility = 'visible';
			ghost.style.opacity = '0.7';
		});
	};
	// Handle drag end
	var _handleDragEnd = function(evt) {
		// Remove drag-over class from order area
		const orderArea = document.getElementById('orderArea');
		orderArea.classList.remove('sortable-drag-over');
		// Remove any lingering ghost classes from placed tiles
		const placedTiles = document.querySelectorAll('.tile');
		placedTiles.forEach(function(tile) {
			if (tile.classList.contains('sortable-ghost')) {
				tile.classList.remove('sortable-ghost');
			}
		});
		// Update sequence from DOM if needed
		if (evt.to === document.getElementById('orderArea')) {
			_updateSequenceFromDOM();
		}
	};
	// Update sequence array from DOM order
	var _updateSequenceFromDOM = function() {
		const orderTiles = Array.from(document.getElementById('orderArea').querySelectorAll('.tile'));
		_sequence.length = 0; 
		orderTiles.forEach(function(tile, index) {
			const tileId = parseInt(tile.getAttribute('data-id'), 10);
			_sequence.push(tileId);
			tile.setAttribute('data-position', index + 1);
		});
		_tilesInSequence = _sequence.length;

		_updateOrderInstructions();
	};
	// Set up event listeners
	var _setupEventListeners = function() {
		// Help button click to show instructions
		$('#help-button').on('click', function() {
			_showInstructions();
		});

		// Help button keyboard handling
		$('#help-button').on('keydown', function(e) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				_showInstructions();
			}
		});

		// Click tile icon to reveal clue
		$('#dragContainer, #orderArea').on('click', '.tile-icon', function(e) {
			e.preventDefault();
			e.stopPropagation();
			const tileId = $(this).data('id');
			if (_tiles[tileId].clue.length > 0) {
				$('.fade').addClass('active');
				$('.board').attr('inert', 'true');
				_revealClue(tileId);
			}
		});

		// Close clue popup
		$('body').on('click', '.clue-close', () => _closeClue());
		$(document).on('keydown', function(e) {
			if ((e.key === 'Escape') && $('#clueHeader').length) {
				_closeClue();
			}
		});

		// On submit sequence clicked
		$('#submit').on('click', () => _submitSequence());

		// Keyboard navigation for tiles
		$(document).on('keydown', '.tile', _keyDownEvent);

		// Submit button keyboard handling
		$('#submit').on('keydown', function(e) {
			if ((e.key === 'Tab') && e.shiftKey) {
				e.preventDefault();
				e.stopPropagation();
				if (_sequence.length > 0) {
					document.getElementById(_sequence[_sequence.length-1]).focus();
				}
			}
		});

		// Wraparound button for keyboard navigation
		$('#wraparound').on('click', function() {
			const unorderedTiles = _tilesInVertOrder.filter(function(t) {
				if (!t) { return false; }
				return _sequence.indexOf(t.id) < 0;
			});
			if (unorderedTiles.length > 0) {
				document.getElementById(unorderedTiles[0].id).focus();
			}
		});

		// List view toggle button
		$('.list-view-btn').on('click', function() {
			_toggleListView();
		});

		// List view button keyboard handling
		$('.list-view-btn').on('keydown', function(e) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				_toggleListView();
			}
		});

		// Global keyboard shortcut for view toggle (Ctrl/Cmd + V)
		$(document).on('keydown', function(e) {
			if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				_toggleListView();
			}
		});
	};



	// Toggle between jumbled pile and list view
	var _toggleListView = function() {
		_isListView = !_isListView;
		const dragContainer = document.getElementById('dragContainer');
		const listViewBtn = document.querySelector('.list-view-btn');
		
		if (_isListView) {
			// Switch to list view
			dragContainer.classList.add('list-view');
			dragContainer.classList.remove('pile-view');
			listViewBtn.textContent = '≡ Pile view';
			listViewBtn.setAttribute('aria-label', 'Switch to pile view');
			
			// Announce view change to screen readers
			_assistiveStatusUpdate('Switched to organized grid view. Tiles are now arranged in rows and columns.');
		} else {
			// Switch to pile view
			dragContainer.classList.remove('list-view');
			dragContainer.classList.add('pile-view');
			listViewBtn.textContent = '≡ List view';
			listViewBtn.setAttribute('aria-label', 'Switch to list view');
			
			_randomizeTilePositions();
			
			_assistiveStatusUpdate('Switched to pile view. Tiles are now in a random arrangement.');
		}
		
		// Update aria-labels for tiles to reflect current view
		_setAriaLabelsForTiles();
	};

	// Randomize tile positions in pile view
	var _randomizeTilePositions = function() {
		const dragContainer = document.getElementById('dragContainer');
		const tiles = Array.from(dragContainer.querySelectorAll('.tile'));
		
		// Shuffle tiles randomly
		for (let i = tiles.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			dragContainer.appendChild(tiles[j]);
		}
		
		// CSS custom properties for rotation, position, and stack order
		tiles.forEach((tile, index) => {
			const randomRotation = (Math.random() - 0.5) * 10;
			const randomX = (Math.random() - 0.5) * 20; 
			const randomY = (Math.random() - 0.5) * 16; 
			// Stack order
			const stackOrder = Math.floor(Math.random() * 10) + 1;
			// Apply the random properties
			tile.style.setProperty('--random-rotation', randomRotation + 'deg');
			tile.style.setProperty('--random-x', randomX + 'px');
			tile.style.setProperty('--random-y', randomY + 'px');
			tile.style.setProperty('--stack-order', stackOrder.toString());
		});
	};

	// Update order instructions visibility
	var _updateOrderInstructions = function() {
		if (_tilesInSequence === 0) {
			$('#orderInstructions').removeClass('hide').addClass('show');
		} else {
			$('#orderInstructions').removeClass('show').addClass('hide');
		}
	};

	// Update position indicators on tiles in sequence
	var _updatePositionIndicators = function() {
		const orderTiles = document.getElementById('orderArea').querySelectorAll('.tile');
		orderTiles.forEach(function(tile, index) {
			const tileId = parseInt(tile.getAttribute('data-id'), 10);
			// const tileName = _tiles[tileId].name;
			tile.setAttribute('data-position', index + 1);
			// Update aria-label with current position
			const currentAriaLabel = tile.getAttribute('aria-label');
			const newAriaLabel = currentAriaLabel.replace(/position \d+ of \d+/, `position ${index + 1} of ${orderTiles.length}`);
			tile.setAttribute('aria-label', newAriaLabel);
		});
		// Announce position update to screen readers
		if (orderTiles.length > 0) {
			_assistiveStatusUpdate(`Positions updated. ${orderTiles.length} tiles in sequence.`);
		}
	};

	// Keyboard navigation
	const _keyDownEvent = function(e) {
		const tileId = parseInt(e.target.getAttribute('data-id'), 10);
		const isInSequence = _sequence.indexOf(tileId) !== -1;orderInstructions
		const sequenceIndex = _sequence.indexOf(tileId);

		switch (e.key) {
			case 'Enter':
				e.preventDefault();
				// Reveal clue if available
				if (_tiles[tileId].clue.length > 0) {
					$('.fade').addClass('active');
					$('.board').attr('inert', 'true');
					_revealClue(tileId);
				}
				break;

			case 'ArrowRight':
				e.preventDefault();
				// Move tile to sequence if not already there
				if (!isInSequence) {
					_moveTileToSequence(tileId);
				}
				break;

			case 'ArrowLeft':
				e.preventDefault();
				// Remove tile from sequence if it's there
				if (isInSequence) {
					_removeTileFromSequence(tileId);
				}
							break;

			case 'ArrowUp':
				e.preventDefault();
				// Move tile up in sequence
				if (isInSequence && sequenceIndex > 0) {
					_moveTileInSequence(tileId, sequenceIndex - 1);
				}
				break;

			case 'ArrowDown':
				e.preventDefault();
				// Move tile down in sequence
				if (isInSequence && sequenceIndex < _sequence.length - 1) {
					_moveTileInSequence(tileId, sequenceIndex + 1);
				}
				break;

			case ' ':
				e.preventDefault();
				// Toggle tile in/out of sequence
				if (isInSequence) {
					_removeTileFromSequence(tileId);
				} else {
					_moveTileToSequence(tileId);
				}
				break;

			case 'v':
			case 'V':
				// Toggle view mode when 'v' is pressed
				if (e.ctrlKey || e.metaKey) {
					e.preventDefault();
					_toggleListView();
				}
				break;
		}
	};

	// Move tile to sequence
	var _moveTileToSequence = function(tileId) {
		const tileElement = document.getElementById(tileId);
		const orderArea = document.getElementById('orderArea');
		
		// Move tile to order area
		orderArea.appendChild(tileElement);
		
		// Update sequence
		_sequence.push(tileId);
		_tilesInSequence = _sequence.length;
		_updatePositionIndicators();
		_updateOrderInstructions();
		_setAriaLabelsForTiles();
		
		// Check if all tiles are sequenced
		if (_tilesInSequence === _numTiles) {
			_tilesSequenced();
		}
		// Accessibility update
		_assistiveStatusUpdate(_tiles[tileId].name + ' added to sequence. ' + _tilesInSequence + ' of ' + _numTiles + ' tiles sorted.');
	};

	// Remove tile from sequence
	var _removeTileFromSequence = function(tileId) {
		const tileElement = document.getElementById(tileId);
		const dragContainer = document.getElementById('dragContainer');
		
		// Move tile back to drag container
		dragContainer.appendChild(tileElement);
		
		// Update sequence
		const index = _sequence.indexOf(tileId);
		if (index > -1) {
			_sequence.splice(index, 1);
		}
		_tilesInSequence = _sequence.length;
		

		_updatePositionIndicators();
		_updateOrderInstructions();
		_setAriaLabelsForTiles();
		
		// Disable submit if not all tiles are sequenced
		if (_tilesInSequence < _numTiles) {
			$('#submit').prop('disabled', true);
			$('#submit').removeClass('enabled');
		}
		
		// Accessibility update
		_assistiveStatusUpdate(_tiles[tileId].name + ' removed from sequence. ' + _tilesInSequence + ' of ' + _numTiles + ' tiles sorted.');
	};

	// Move tile within sequence
	var _moveTileInSequence = function(tileId, newIndex) {
		const tileElement = document.getElementById(tileId);
		const orderArea = document.getElementById('orderArea');
		
		// Remove from current position
		const currentIndex = _sequence.indexOf(tileId);
		_sequence.splice(currentIndex, 1);
		
		// Insert at new position
		_sequence.splice(newIndex, 0, tileId);
		console.log(_sequence, currentIndex, newIndex)
		// Update DOM
		
		if(orderArea.children[newIndex]) {
			if(newIndex > currentIndex)
				orderArea.children[newIndex].insertAdjacentElement('afterend', tileElement)
			else
				orderArea.children[newIndex].insertAdjacentElement('beforebegin', tileElement)
		}
		
		_updatePositionIndicators();
		_setAriaLabelsForTiles();
		// Accessibility update
		_assistiveStatusUpdate(_tiles[tileId].name + ' moved to position ' + (newIndex + 1) + ' of ' + _tilesInSequence);
	};

	// Instructions functions 
	var _startDemo = function() {
		const instructionsScreen = _.template($('#instructions-window').html());

		if (_practiceMode === true) {
			_freeAttempts = 'unlimited';
			_qset.options.penalty = 0;
		}

		const _$instructions = $(instructionsScreen({
			freeAttempts: _freeAttempts || "unlimited"
		}));
		$('body').append(_$instructions);
		$('.fade').addClass('active');
		$('.board').attr('inert', 'true');

		// Set up instruction navigation
		_setupInstructionNavigation();

		// Focus the first button for accessibility
		$('#next-to-keyboard').focus();
	};

	var _setupInstructionNavigation = function() {
		// Next button (How to Play -> Keyboard Controls)
		$('#next-to-keyboard').on('click', function() {
			$('#page-how-to-play').addClass('hidden');
			$('#page-keyboard').removeClass('hidden');
			$('#start-game').focus();
		});
		// Previous button (Keyboard Controls -> How to Play)
		$('#prev-to-how-to-play').on('click', function() {
			$('#page-keyboard').addClass('hidden');
			$('#page-how-to-play').removeClass('hidden');
			$('#next-to-keyboard').focus();
		});
		// Start Game button
		$('#start-game').on('click', _closeInstructions);
		// Close button
		$('.instructions-close').on('click', _closeInstructions);
		// Keyboard navigation
		$(document).on('keydown.instructions', function(e) {
			if (e.key === 'Escape') {
				_closeInstructions();
			}
		});
	};

	var _closeInstructions = function() {
		$('#instructionsHeader').remove();
		$('.fade').removeClass('active');
		$('.board').removeAttr('inert');
		$(document).off('keydown.instructions');
		
		if (_tilesInVertOrder && _tilesInVertOrder.length > 0) {
			document.getElementById(_tilesInVertOrder[0].id).focus();
		}
	};

	// Show instructions popup (for help button)
	var _showInstructions = function() {
		const instructionsScreen = _.template($('#instructions-window').html());

		if (_practiceMode === true) {
			_freeAttempts = 'unlimited';
			_qset.options.penalty = 0;
		}
		const _$instructions = $(instructionsScreen({
			freeAttempts: _freeAttempts || "unlimited"
		}));
		$('body').append(_$instructions);
		$('.fade').addClass('active');
		$('.board').attr('inert', 'true');
		// Set up instruction navigation
		_setupInstructionNavigation();
		// Focus the first button for accessibility
		$('#next-to-keyboard').focus();
	};






	// All tiles have been moved to the orderArea
	var _tilesSequenced = function() {
		const newMessage = _.template($('#message-window').html());
		const message = $(newMessage({title: 'Submit Your Sequence', messageText: 'Make sure you have the right sequence and press the \"Submit Sequence\" button.'}));
		$('body').append(message);
		message.addClass('show');
		$('.board').attr('inert', 'true');
		$('#submit').prop('disabled', false);
		$('#submit').addClass('enabled');
		
		$('#okayButton').focus();
		// Event listener for okay button
		$('#okayButton').on('click', _closeSubmitSequencePopup);
		// Keyboard support for okay button
		$('#okayButton').on('keydown', function(e) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				_closeSubmitSequencePopup();
			}
		});
		// Escape key support
		$(document).on('keydown.submitSequence', function(e) {
			if (e.key === 'Escape') {
				_closeSubmitSequencePopup();
			}
		});
	};

	// Answer submitted by user
	var _submitSequence = function() {
		$('.fade').addClass('active');
		// Get order of the tiles for grading and grade the sequence based on order of tiles
		const correct = _determineNumCorrect(_sequence);
		return _showResults(correct);
	};

	// Compare the order of the submitted sequence to the correct ordering
	var _determineNumCorrect = function(submitted) {
		let numCorrect = 0;
		let correctOrder = 0;
		for (var i of Array.from(submitted)) {
			if (_tiles[i].order === correctOrder) {
				numCorrect++;
			}
			correctOrder++;
		}
		return numCorrect;
	};

	// Displays the results template after user has submitted a sequence
	var _showResults = function(results) {
		// Calculate current score
		const currentScore = Math.round((results / _numTiles) * 100);
		
		// Update highest score if current score is better
		if (currentScore > highestScore) {
			highestScore = currentScore;
			_saveHighestScores();
		}
		
		// Update the score display
		const scoreString = highestScore + "%";
		$('#score').html(scoreString);
		
		// Decrement attempts (unless perfect score)
		if (results !== _numTiles) {
			_freeAttempts--;
			_attempts++;
		} else {
			// Restore attempt for perfect score
			_freeAttempts++;
		}
		
		// Update attempts display
		if ((_freeAttempts > 0) || _practiceMode) {
			$('#attemptsLeft').html(_freeAttempts);
			if (_freeAttempts === 0) {
				$('#attempts-info').addClass('hidden');
			}
		}

		// Results template window
		const tResults = _.template($('#results-popup').html());
		const $results = $(tResults({
			correct: results,
			total: _numTiles,
			highestScore: highestScore,
			freeAttempts: _freeAttempts,
			practiceMode: _practiceMode
		}));

		$('body').append($results);
		$('.fade').addClass('active');
		$('.board').attr('inert', 'true');
		
		// Set up event listeners for the new results popup
		_setupResultsEventListeners(results);
		
		return $('#submit').prop('disabled', true);
	};

	// Set up event listeners for the new results popup
	var _setupResultsEventListeners = function(results) {
		// Close button
		$('.results-close').on('click', function() {
			_closeResults();
		});
		
		// Escape key to close
		$(document).on('keydown.results', function(e) {
			if (e.key === 'Escape') {
				_closeResults();
			}
		});
		
		// Main action button (Try Again or Visit Score Screen)
		$('#resultsButton').on('click', function() {
			if ((_freeAttempts > 0) || _practiceMode) {
				// Try again
				_closeResults();
			} else {
				// No more attempts - go to score screen
				_sendScores();
				_end(false);
			}
		});
		
		// Perfect score button (Visit Score Screen)
		$('#submitScoreButton').on('click', function() {
			// Perfect score - go to score screen
			_sendScores();
			_end(true);
		});
		
		// Submit score button (finish with best score)
		$('#submitScoreButton').on('click', function() {
			$('#resultsHeader').remove();
			$('.bestscore').html(highestScore + "%");
			$('.confirmDialog').addClass('show');
			$('.confirmDialog').removeAttr('inert');
			$('.confirmDialog').children('button').attr('tabindex', 0);
			
			$('#confirmBestScoreButton').on('click', function() {
				_sendScores();
				_end(true);
			});
			
			$('#cancelBestScoreButton').on('click', function() {
				$('.confirmDialog').removeClass('show');
				$('.confirmDialog').attr('inert', 'true');
				$('.confirmDialog').children('button').attr('tabindex', -1);
				_closeResults();
			});
		});
		
		$('#resultsButton').focus();
	};
	
	// Close results popup
	var _closeResults = function() {
		$('#resultsHeader').remove();
		$('.fade').removeClass('active');
		$('.board').removeAttr('inert');
		$(document).off('keydown.results');
		
		// Re-enable submit button if all tiles are still sequenced
		if (_tilesInSequence === _numTiles) {
			$('#submit').prop('disabled', false);
			$('#submit').addClass('enabled');
		}
	};



	// Accessibility functions
	var _assistiveStatusUpdate = status => $('.ariaLiveStatus').html(status);

	var _setAriaLabelsForTiles = () => (() => {
        const result = [];
        for (var tile of Array.from(_tiles)) {
            if (tile) { result.push(_setAriaLabelForTile(tile)); } else {
                result.push(undefined);
            }
        }
        return result;
    })();

	var _setAriaLabelForTile = function(tile) {
		let tileLabel = tile.name + '.';
		const sequencedIndex = _sequence.indexOf(tile.id);
		if (sequencedIndex >= 0) {
			tileLabel = tileLabel + ' This tile is in the sequence at position ' + (sequencedIndex + 1) + ' of ' + _tilesInSequence + '.';
		} else {
			tileLabel = tileLabel + ' This tile has not been added to the sequence.';
		}
		if (tile.clue === '') {
		} 
		else {
			tileLabel = tileLabel + ' This tile has a clue, click the question mark icon to review it.';
		}
		// Add view mode information
		if (_isListView) {
			tileLabel = tileLabel + ' Currently in list view.';
		} else {
			tileLabel = tileLabel + ' Currently in pile view.';
		}
		return $('#'+tile.id).attr('aria-label', tileLabel);
	};

	var _updateWraparoundAriaLabel = function() {
		const labelPlusRemaining = 'Press Space or Enter to select the first unsorted tile, there are ' +
			(_numTiles - _tilesInSequence) +
			' unsorted tiles remaining.';
		return $('#wraparound').attr('aria-label', labelPlusRemaining);
	};

	// Show the clue from the id of the tile clicked
	var _revealClue = function(id) {
		// Get data for new clue
		const tileClue = _.template($('#tile-clue-window').html());
		const $tileC = $(tileClue({
			name: _tiles[id].name,
			clue: _tiles[id].clue
		}));

		// Remove old clue if exists
		$('#clueHeader').remove();
		
		// Add new clue to body
		return $('body').append($tileC);
	};

	var _closeClue = function() {
		$('#clueHeader').remove();
		$('.fade').removeClass('active');
		return $('.board').removeAttr('inert');
	};

	// Close submit sequence popup
	var _closeSubmitSequencePopup = function() {
		$('#submitSequencePopup').remove();
		$('.board').removeAttr('inert');
		$(document).off('keydown.submitSequence');
		
		// Check if all tiles are still sequenced and maintain submit button state
		if (_tilesInSequence === _numTiles) {
			$('#submit').prop('disabled', false);
			$('#submit').addClass('enabled');
		} else {
			$('#submit').prop('disabled', true);
			$('#submit').removeClass('enabled');
		}
	};

	var _sendScores = function() {
		// const answer = 0;
		let j = 1;
		return (() => {
			const result = [];
			for (var i of Array.from(_highestSequence)) {
				Materia.Score.submitQuestionForScoring(_tiles[i].qid, j, 100);
				result.push(j++);
			}
			return result;
		})();
	};

	var _saveHighestScores = function() {
		_highestSequence = [];
		return Array.from(_sequence).map((i) =>
			_highestSequence.push(i));
	};

	var _end = function(gotoScoreScreen) {
		if (gotoScoreScreen == null) { gotoScoreScreen = true; }
		return Materia.Engine.end(gotoScoreScreen);
	};

	return {
		manualResize: true,
		start
	};
})();

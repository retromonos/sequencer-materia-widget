/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
Namespace('Sequencer').Creator = (function() {
	let _widget  = null; // Holds widget data
	let _qset    = null; // Keep tack of the current qset
	let _title   = null; // Hold on to this instance's title
	let _version = null; // Holds the qset version, allows you to change your widget to support old versions of your own code

	// variables to contain templates for various page elements
	let _qTemplate = null;
	let _qWindowTemplate = null;
	let _aTemplate = null;
	let _numTiles = 0;
	const _maxTiles = 20;

	// strings containing tutorial texts, boolean for tutorial mode
	const _tutorial_help = false;
	const _openQ = null;
	const _openQWindow = null;

	// creating the tutorial from HTML classes
	const tutorial1 = $('.tutorial.step1');
	const tutorial2 = $('.tutorial.step2');
	const tutorial3 = $('.tutorial.step3');

	const _defaultTileString =  '';
	const _defaultClickString = 'Click to add tile';
	const _defaultClueString = 'Enter optional information here';

	const initNewWidget = (widget, baseUrl) => _buildDisplay('My Sequencer Widget', widget);

	const initExistingWidget = (title, widget, qset, version, baseUrl) => _buildDisplay(title, widget, qset, version);

	const onSaveClicked = function(mode) {
		if (mode == null) { mode = 'save'; }
		if (_buildSaveData()) {
			return Materia.CreatorCore.save(_title, _qset);
		} else {
			return Materia.CreatorCore.cancelSave('Widget not ready to save.');
		}
	};

	const onSaveComplete = (title, widget, qset, version) => true;

	const onQuestionImportComplete = questions => (() => {
        const result = [];
        for (var question of Array.from(questions)) {
            question.questions[0].text = question.questions[0].text.substring(0, 40);
            result.push(_addQuestion(question));
        }
        return result;
    })();

	// This basic widget does not support media
	const onMediaImportComplete = media => null;

	// Set up page and listen
	var _buildDisplay = function(title, widget, qset, version) {
		if (title == null) { title = 'Default test Title'; }
		_version = version;
		_qset    = qset;
		_widget  = widget;
		_title   = title;

		$('#title').val(_title);

		// Fill the template objects
		if (!_qTemplate) {
			_qTemplate = $('.template.question');
			$('.template.question').remove();
			_qTemplate.removeClass('template');
		}
		if (!_qWindowTemplate) {
			_qWindowTemplate = $('.template.question_window');
			$('.template.question_window').remove();
			_qWindowTemplate.removeClass('template');
		}
		if (!_aTemplate) {
			_aTemplate = $('.template.answer');
			$('.template.answer').remove();
			_aTemplate.removeClass('template');
		}

		// initial window
		$('#startPopup').addClass('show');
		$('#fader').addClass('dim');

		$('#addSliderButton').on('keydown', (e) => {
			if(e.key === "Enter")
				$('#addSliderButton').click()
		})
		$('#addSliderButton').on('click', function() {
			$('#columnSection').removeClass('hidden');
			$('#first_step').removeClass('show');
			return _addNewTileSlider();
		});

		// Add a slider between two tiles
		$('body').delegate('.addTileDot', 'keydown', (e) => {
			if(e.key === "Enter")
				e.target.click()
		})
		$('body').delegate('.addTileDot', 'click', function() {
				_addNewTileSlider($(this).parent().parent());
				_updateTileNums();
				return $(this).parent().parent().children('.tile-line').css({
					'opacity': '0',
				});
		});

		// Remove Slider
		$('body').on('click', '.tile-action-delete', function(e) {
			e.preventDefault();
			e.stopPropagation();
			const tile = $(e.target).closest('.tileInfoSlider');
			_numTiles--;

			if(_numTiles <= 0)
				$('#columnSection').addClass('hidden');

			tile.remove();
			return _updateTileNums();
		});

		$('#options').on('click', function() {
			$('#optionsPopup').addClass('show');
			$('#fader').addClass('dim');
		});
		$('#options').on('keydown', function(e) {
			if(e.key === "Enter") {
				$('#options').click()
			}
		});
		$('.popup-close').on('click', function() {
			$(this).closest('.popup').removeClass('show');
			$('#fader').removeClass('dim');
		});
		$('.closeWindow').on('click', function() {
			$(this).closest('.popup').removeClass('show');
			$('#fader').removeClass('dim');

			// Set the title
			if ($(this).closest('.popup').attr('id') === 'startPopup') {
				title = $('#inputTitle').val();
				if (title === '') { title = 'My Sequencer Widget'; }
				$('#title').val(title);
				return $('#first_step').addClass('show');
			// #Set the penalty amount
			} else if ($('#assessmentOptions').hasClass('show')) {
				$('#numTriesInput').val(~~$('#numTriesInput').val() || 1);
				return $('#numTries').html($('#numTriesInput').val() + ' guesses');
			}
		});

		$('#inputTitle').on('keyup', function(e) {
			if (e.which === 13) {
				return $('.closeWindow').click();
			}
		});

		$('#modeContainer').on('keydown', (e) => {
			if(e.key === "Enter")
				$('#modeContainer').click()
		})

		$('#modeContainer').on('click', function() {
			$('#modeSlider').toggleClass('slide');
			$('#assessmentOptions').toggleClass('active');
			$('#practiceMode').toggleClass('active');
			$('#assessmentMode').toggleClass('active');
			$('#assessmentOptions').toggleClass('show');
			$('#practiceDetails').toggleClass('show');
			return $('#assessmentDetails').toggleClass('show');
		});

		if (__guard__(_qset != null ? _qset.options : undefined, x => x.practiceMode)) {
			$('#modeSlider').toggleClass('slide');
			$('#assessmentOptions').toggleClass('active');
			$('#practiceMode').toggleClass('active');
			$('#assessmentMode').toggleClass('active');
			$('#assessmentOptions').toggleClass('show');
			$('#practiceDetails').toggleClass('show');
			$('#assessmentDetails').toggleClass('show');
		}
		$('#numTries').html($('#numTriesInput').val() + ' guesses');

		// Some set of questions already exists
		if (_qset != null) {
			const questions = _qset.items;
			for (var question of Array.from(questions)) { _addQuestion(question); }

			$('#numTriesInput').val(_qset.options != null ? _qset.options.freeAttempts : undefined);
			return $('#numTries').html($('#numTriesInput').val() + ' guesses');
		}
	};

	var _addQuestion = function(question) {
		$('#first_step').removeClass('show');
		$('#startPopup').removeClass('show');
		$('#fader').removeClass('dim');

		return _addNewTileSlider(null, question.questions[0].text, question.options.description, question.id);
	};

	// Change radio game modes
	const _updateGameMode = function() {
		if ($('#assessmentRadio').is(':checked')) {
			$('#penaltyBox').addClass('show');
			return $('#freeBox').addClass('show');
		} else {
			$('#penaltyBox').removeClass('show');
			return $('#freeBox').removeClass('show');
		}
	};

	// Add new slider
	var _addNewTileSlider = function(position, tileString, clueString, id) {
		if (tileString == null) { tileString = ''; }
		if (clueString == null) { clueString = ''; }
		if (id == null) { id = ''; }
		if (_numTiles === _maxTiles) {
			Materia.CreatorCore.alert('Maximum Tiles', 'You may only have up to '+ _maxTiles + ' tiles in this widget.');
			return;
		}
		_numTiles++;

		$('#addSliderButton').addClass('slide');
		// if (tileString === '') {
		// 	$('#second_step').addClass('show');
		// } else {
		// 	$('#second_step').css('display', 'none');
		// }

		// Add a new Slider
		const newTileSlot = _.template($('#t-slide-info').html());
		const tileSlot = $(newTileSlot({tileNum: _numTiles, tileText: tileString, clueText: clueString, id}));

		if (position != null) {
			$(tileSlot).insertBefore((position));
		} else {
			$(tileSlot).insertBefore(($('#addSliderButton')));
		}
		$(tileSlot).offset();
		$(tileSlot).addClass('appear');
		return $(tileSlot).find('.tile-text').focus().on('keyup', e => $('#second_step').css('display', 'none'));
	};

	// Change the number on the sliders
	var _updateTileNums = function() {
		let i = 1;
		return $('.tileInfoSlider').each(function() {
			$(this).find('.block .number').html(i);
			return i++;
		});
	};

	// On preview/publish/save click
	var _buildSaveData = function() {
		let okToSave = false;

		// Create new qset object if we don't already have one, set default values regardless.
		if (_qset == null) {
			_qset = {};
		}
		_qset.options = {};
		_qset.assets = [];
		_qset.rand = false;

		if ($('#practiceMode').hasClass('active')) {
			_qset.options.practiceMode = true;
		} else {
			_qset.options.practiceMode = false;
		}
		_qset.options.freeAttempts = $('#numTriesInput').val() || 1;
		_qset.name = $('#title').val();

		// update our values
		_title = $('#title').val();
		if ((_title != null) && (_title !== '')) { okToSave = true; } else { Materia.CreatorCore.alert('Widget has no title', 'You must enter a title for this widget'); }

		const tList = _loadingItemsForSave();
		if (tList === -1) {
			okToSave = false;
		}
		tList.assets = [];
		tList.options = {cid: 0};

		_qset.items = tList.items;
		return okToSave;
	};

	// Get each Tile's data from the appropriate info
	var _loadingItemsForSave = function() {
		const tileList = {items: []};

		let i = 0;

		// Organize all tile names and tile clues
		for (var t of Array.from($('.tileInfoSlider'))) {
			var tileName = _validateTileString('tile-text', $(t).find('.title').val());
			var tileClue = _validateTileString('clue-text', $(t).find('.cluetext').val());
			var id = $(t).attr('data-id');

			if ((tileName === -1) || (tileClue === -1)) {
				return -1;
			}

			var item = {
				id,
				type: 'QA',
				materiaType: 'question',
				questions: [{
					id: '',
					text: tileName
				}],
				answers: [{
					id: '',
					value: 100,
					text: ++i
				}],
				options: {
					description: tileClue
				}
			};
			tileList.items.push(item);
		}

		return tileList;
	};

	// Returns the tile if valid or null if not changed
	var _validateTileString = function(type, text) {
		// Tile text
		if (type === 'tile-text') {
			if (text === _defaultTileString) {
				Materia.CreatorCore.alert('Unnamed Tile', 'You must enter a name for all tiles.');
				text = null;
				return -1;
			}

		// Clue text
		} else {
			if (text === _defaultClueString) {
				text = null;
			}
		}
		return text;
	};

	//public
	return {
		initNewWidget,
		initExistingWidget,
		onSaveClicked,
		onMediaImportComplete,
		onQuestionImportComplete,
		onSaveComplete
	};
})();

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}

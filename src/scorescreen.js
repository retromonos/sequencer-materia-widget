Namespace('Sequencer').ScoreCore = (function() {
	
	let _qset = null;
	let _questions = null;
    let _sequenceArea = null;
    let _sequenceTemp = null;

	const _getRenderedHeight = () => {
		return Math.ceil(parseFloat(window.getComputedStyle(document.querySelector('html')).height)) - 21;
	}

	const start = (instance, qset, scoreTable, isPreview, qsetVersion) => {
		update(qset, scoreTable)
	}

	const update = (qset, scoreTable) => {
        window.addEventListener("resize", ()=>Materia.ScoreCore.setHeight(_getRenderedHeight()))

		_qset = qset
		_questions = _qset.items;

        console.log(_qset)
        console.log(scoreTable)

        if(!_sequenceArea) {
            _sequenceArea = document.getElementById("sequence-area")
            _sequenceTemp = document.importNode(document.getElementById("sequence-template").content, true)
        } else _sequenceArea.innerHTML = ""

        scoreTable.forEach((v,i) => {
            const sequence = document.importNode(_sequenceTemp, true)

            const isCorrect = v.score === 100

            const number = sequence.querySelector("p")
            number.innerHTML = i+1
            
            const user = sequence.querySelector(".card.user")
            user.innerHTML = v.data[0]

            const correct = sequence.querySelector(".card.correct")
            console.log(v.data[2] - 1)
            correct.innerHTML = _questions[v.data[1] - 1].questions[0].text

            const indicator = sequence.querySelector(".indicator")
            if(isCorrect)
                indicator.classList.add("right")
            else
                indicator.classList.add("wrong")

            _sequenceArea.appendChild(sequence)
        })

		Materia.ScoreCore.setHeight(_getRenderedHeight());
	}

	return {
		start, update
	}
})();

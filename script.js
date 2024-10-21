for (let i = 1; i <= 30; i++) {
    const gridItem = document.createElement('div');
    gridItem.className = 'grid-item';
    gridItem.setAttribute('data-card', 'card' + i);
    gridItem.textContent = 'nov ' + i;
    document.querySelector('.grid-container').appendChild(gridItem);
    const cardDisplay = document.createElement('div');
    cardDisplay.className = 'card-display';
    cardDisplay.id = 'card' + i;
    const card = document.createElement('div');
    card.className = 'card';
    card.onclick = function() {
        this.classList.toggle('is-flipped');
    };
    const cardFront = document.createElement('div');
    cardFront.className = 'card-face card-front';
    cardFront.innerHTML = '<img src="cards/day' + i + 'front.png">';
    const cardBack = document.createElement('div');
    cardBack.className = 'card-face card-back';
    cardBack.innerHTML = '<img src="cards/day' + i + 'back.png">';
    card.appendChild(cardFront);
    card.appendChild(cardBack);
    cardDisplay.appendChild(card);
    document.getElementById('cards-container').appendChild(cardDisplay);
}

document.querySelectorAll('.grid-item').forEach(item => {
    item.addEventListener('click', function(event) {
		event.stopPropagation();
        document.querySelectorAll('.card-display').forEach(card => {
        	if (card.style.display != 'none') {
        		card.style.animationName = 'slideOutRight';
	        	card.addEventListener('animationend', function() {
	        		if (card.style.animationName == 'slideOutRight')
	    				card.style.display = 'none';
	        	});
	        }
        });
        const cardId = this.getAttribute('data-card');
        document.getElementById(cardId).style.display = 'block';
    	document.getElementById(cardId).style.animationName = 'slideInLeft';
    });
});

document.addEventListener('click', function(event) {
    document.querySelectorAll('.card-display').forEach(card => {
        if (!card.contains(event.target) && card.style.display != 'none') {
    		card.style.animationName = 'slideOutRight';
        	card.addEventListener('animationend', function() {
        		if (card.style.animationName == 'slideOutRight')
    				card.style.display = 'none';
        	});
        }
    });
});

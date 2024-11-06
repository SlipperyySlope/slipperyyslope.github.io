for (let i = 1; i <= 30; i++) {
    const gridItem = document.createElement('div');
    gridItem.className = 'grid-item';
    gridItem.setAttribute('data-card', 'card' + i);
    gridItem.textContent = i;
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
    const link = document.createElement('a');
    link.href = i + '.html';
    link.className = 'card-url';
    link.innerHTML = '<span class="url-text">submissions</span>';
    cardDisplay.appendChild(card);
    cardDisplay.appendChild(link);
    document.getElementById('cards-container').appendChild(cardDisplay);
}

document.querySelectorAll('.grid-item').forEach(item => {
    item.addEventListener('click', function(event) {
		event.stopPropagation();
		item.classList.add('clicked');
        document.querySelectorAll('.grid-item').forEach(item_o => {
        	if (!item.isEqualNode(item_o)) {
				item_o.classList.remove('clicked');
	        }
		    document.querySelectorAll('.popup').forEach(popup => {
		        if (!popup.contains(event.target) && popup.style.display != 'none') {
		    		popup.style.animationName = 'slideOutRight';
		        	popup.addEventListener('animationend', function() {
		        		if (popup.style.animationName == 'slideOutRight')
		    				popup.style.display = 'none';
		        	});
		        }
		    });
        });
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

document.querySelectorAll('.rulesmenu').forEach(item => {
    item.addEventListener('click', function(event) {
		event.stopPropagation();
        document.querySelectorAll('.popup').forEach(popup => {
        	if (popup.style.display != 'none') {
        		popup.style.animationName = 'slideOutRight';
	        	popup.addEventListener('animationend', function() {
	        		if (popup.style.animationName == 'slideOutRight')
	    				popup.style.display = 'none';
	        	});
	        }
        });
        document.querySelector('.rules').style.display = 'block';
    	document.querySelector('.rules').style.animationName = 'slideInLeft';
    });
});

document.querySelectorAll('.textmenu').forEach(item => {
    item.addEventListener('click', function(event) {
		event.stopPropagation();
        document.querySelectorAll('.popup').forEach(popup => {
        	if (popup.style.display != 'none') {
        		popup.style.animationName = 'slideOutRight';
	        	popup.addEventListener('animationend', function() {
	        		if (popup.style.animationName == 'slideOutRight')
	    				popup.style.display = 'none';
	        	});
	        }
        });
        document.querySelector('.textonly').style.display = 'block';
    	document.querySelector('.textonly').style.animationName = 'slideInLeft';
    });
});

document.querySelectorAll('.entries').forEach(item => {
    item.addEventListener('click', function(event) {
        event.stopPropagation();
        window.open('all.html', '_self').focus();
    });
});

document.querySelectorAll('.submit').forEach(item => {
    item.addEventListener('click', function(event) {
		event.stopPropagation();
		window.open('https://forms.gle/A9Pos4QKTHfwsQuU8', '_blank').focus();
    });
});

document.addEventListener('click', function(event) {
	const isClickOnCard = event.target.closest('.card-display') !== null;
	if (!isClickOnCard) {
		document.querySelectorAll('.grid-item').forEach(item => {
			item.classList.remove('clicked');
		});
	}
    document.querySelectorAll('.card-display').forEach(card => {
        if (!card.contains(event.target) && card.style.display != 'none') {
    		card.style.animationName = 'slideOutRight';
        	card.addEventListener('animationend', function() {
        		if (card.style.animationName == 'slideOutRight')
    				card.style.display = 'none';
        	});
        }
    });
    document.querySelectorAll('.popup').forEach(popup => {
        if (!popup.contains(event.target) && popup.style.display != 'none') {
    		popup.style.animationName = 'slideOutRight';
        	popup.addEventListener('animationend', function() {
        		if (popup.style.animationName == 'slideOutRight')
    				popup.style.display = 'none';
        	});
        }
    });
});

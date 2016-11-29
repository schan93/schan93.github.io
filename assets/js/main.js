$(document).ready(function () {
	//Application setup values
	var APPLICATION_ID = 'DQB9P11KG0';
	var SEARCH_ONLY_API_KEY = '15e2b97e443188bc7d372444cac5d59e';
	var RESTAURANTS_INDEX = 'restaurants_list';
	var PARAMS = {
	  hitsPerPage: 3,
	  maxValuesPerFacet: 7,
	  facets: ['food_type', 'stars_count', 'payment_options'],
	  index: RESTAURANTS_INDEX
	};

	var FACETS_STARS_COUNT = ['stars_count'];
	var FACETS_PAYMENT_OPTIONS = ['payment_options'];
	var FACETS_ORDER_OF_DISPLAY = ['food_type', 'stars_count', 'payment_options'];
	var FACETS_LABELS = {food_type: 'Cuisine/Food Type', stars_count: 'Rating', payment_options: 'Payment Options'};

	// Algolia Search Client + Helper initialization
	var algolia = algoliasearch(APPLICATION_ID, SEARCH_ONLY_API_KEY);
	var algoliaHelper = algoliasearchHelper(algolia, RESTAURANTS_INDEX, PARAMS);

	// DOM Binding
	$searchInput = $('#search-input');
	$searchInputIcon = $('#search-input-icon');
	$main = $('main');
	$sortBySelect = $('#sort-by-select');
	$hits = $('#hits');
	$stats = $('#stats');
	$facets = $('#facets');
	$pagination = $('#pagination');

	// Hogan templates binding
	var hitTemplate = Hogan.compile($('#hit-template').text());
	var statsTemplate = Hogan.compile($('#stats-template').text());
	var facetTemplate = Hogan.compile($('#facet-template').text());
	var paginationTemplate = Hogan.compile($('#pagination-template').text());
	var noResultsTemplate = Hogan.compile($('#no-results-template').text());

	// Initial search which gets the first search by location. 
	//There will be some latency when getting the first search, but that is because we need to get the user's location
	//Before we can query
	getLocation();

	//Search input. Whenever a key is pressed, the query variable grabs that value and the algoliaHelper queries 
	//for the information in query.
	$searchInput
	.on('input propertychange', function(e) {
	  // toggleIconEmptyInput(query);
	  var query = e.currentTarget.value;
	  // algoliaHelper.setQueryParameter('aroundLatLng', '37.559720, -122.271010');
	  // getLocation(query);
	  var lat = sessionStorage.getItem('location.latitude');
	  var lng = sessionStorage.getItem('location.longitude');
	  if(lat && lng) {
	  	algoliaHelper.setQuery(query).setQueryParameter(lat + ' , ' + lng).search();
	  } else {
	  	algoliaHelper.setQuery(query).search();
	  }
	})
	.focus();

	//Put the empty class on the query if the query is not empty.
	function toggleIconEmptyInput(query) {
	  $searchInputIcon.toggleClass('empty', query.trim() !== '');
	}

	//Once we get the search results, we want to display the results and stats of our search result.
	algoliaHelper.on('result', function(content, state) {
	  renderStats(content);
	  renderHits(content);
	  renderFacets(content, state);
	  renderPagination(content);
	  handleNoResults(content);
	});

	//Show Facets when the results are loaded.
	function renderFacets(content, state) {
	  var facetsHtml = '';
	  //Loop through all the facets that we want to display and show them on the left hand side
	  for (var facetIndex = 0; facetIndex < FACETS_ORDER_OF_DISPLAY.length; ++facetIndex) {
	    var facetName = FACETS_ORDER_OF_DISPLAY[facetIndex];
	    var facetResult = content.getFacetByName(facetName);
	    if (!facetResult) continue;
	    var facetContent = {};
    	//Regular facets for payment or for food type
	    facetContent = {
	      facet: facetName,
	      title: FACETS_LABELS[facetName],
	      values: content.getFacetValues(facetName, {sortBy: ['isRefined:desc', 'count:desc']}),
	    };
	    facetsHtml += facetTemplate.render(facetContent);
	  }
	  $facets.html(facetsHtml);
	}

	//Listens to click on fascet
	$(document).on('click', '.toggle-refine', function(e) {
	  e.preventDefault();
	  algoliaHelper.toggleRefine($(this).data('facet'), $(this).data('value')).search();
	});

	//Show the pagination "Show more/less"
	function renderPagination(content) {
	  var pages = [];
	  if (content.page > 3) {
	    pages.push({current: false, number: 1});
	    pages.push({current: false, number: '...', disabled: true});
	  }
	  for (var p = content.page - 3; p < content.page + 3; ++p) {
	    if (p < 0 || p >= content.nbPages) continue;
	    pages.push({current: content.page === p, number: p + 1});
	  }
	  if (content.page + 3 < content.nbPages) {
	    pages.push({current: false, number: '...', disabled: true});
	    pages.push({current: false, number: content.nbPages});
	  }
	  var pagination = {
	    pages: pages,
	    prev_page: content.page > 0 ? content.page : false,
	    next_page: content.page + 1 < content.nbPages ? content.page + 2 : false
	  };
	  $pagination.html(paginationTemplate.render(pagination));
	}

	//Handling pagination click events
	$(document).on('click', '.go-to-page', function(e) {
	  e.preventDefault();
	  $('html, body').animate({scrollTop: 0}, '500', 'swing');
	  algoliaHelper.setCurrentPage(+$(this).data('page') - 1).search();
	});

	//Function to call the $hits variable and use the hitTemplate to show the results on the page
	function renderHits(content) {
		var promise = new Promise(function(resolve, reject) {
			$hits.html(hitTemplate.render(content));
			resolve();
		});
		promise.then(function(val) {
			$(function() {
			  $('span.stars').stars();
			});
		});

		$.fn.stars = function() { 
		  return this.each(function() {
		    // Get the value
		    var val = parseFloat($(this).html()); 
		    val = Math.round(val * 2) / 2;
		    // Make sure that the value is in 0 - 5 range, multiply to get width
		    var size = Math.max(0, (Math.min(5, val))) * 36.5; 
		    // Create stars holder
		    var $span = $('<span> </span>').width(size); 
		    // Replace the numerical value with stars
		    $(this).empty().append($span);
		  });
		}
	};

	

	function renderStats(content) {
	  //Divide the processingTime by 1000 because need to show as seconds, not MS
	  var stats = {
	    nbHits: content.nbHits,
	    nbHits_plural: content.nbHits !== 1,
	    processingTimeMS: parseFloat(content.processingTimeMS / 1000).toFixed(3)
	  };
	  $stats.html(statsTemplate.render(stats));
	}

	//Show no results in search results section
	function handleNoResults(content) {
	  if (content.nbHits > 0) {
	    $main.removeClass('no-results');
	    return;
	  }
	  $main.addClass('no-results');

	  var filters = [];
	  var i;
	  var j;
	  for (i in algoliaHelper.state.facetsRefinements) {
	    filters.push({
	      class: 'toggle-refine',
	      facet: i, facet_value: algoliaHelper.state.facetsRefinements[i],
	      label: FACETS_LABELS[i] + ': ',
	      label_value: algoliaHelper.state.facetsRefinements[i]
	    });
	  }
	  for (i in algoliaHelper.state.disjunctiveFacetsRefinements) {
	    for (j in algoliaHelper.state.disjunctiveFacetsRefinements[i]) {
	      filters.push({
	        class: 'toggle-refine',
	        facet: i,
	        facet_value: algoliaHelper.state.disjunctiveFacetsRefinements[i][j],
	        label: FACETS_LABELS[i] + ': ',
	        label_value: algoliaHelper.state.disjunctiveFacetsRefinements[i][j]
	      });
	    }
	  }
	  for (i in algoliaHelper.state.numericRefinements) {
	    for (j in algoliaHelper.state.numericRefinements[i]) {
	      filters.push({
	        class: 'remove-numeric-refine',
	        facet: i,
	        facet_value: j,
	        label: FACETS_LABELS[i] + ' ',
	        label_value: j + ' ' + algoliaHelper.state.numericRefinements[i][j]
	      });
	    }
	  }
	  $hits.html(noResultsTemplate.render({query: content.query, filters: filters}));
	}

	//Function to get the user's location so that queries are based on user's current location
	function getLocation() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
          var pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          //Use session storage to store the location of a user so that we don't always have to be in this
          //Callback to get the location coordinates. This can be stored in statically because we can assume 
          //He or she will be in one location, and session storage will be updated once you clear the browser
          sessionStorage.setItem('location.latitude', position.coords.latitude);
          sessionStorage.setItem('location.longitude', position.coords.longitude);
          algoliaHelper.setQueryParameter('aroundLatLng', pos.lat + ' , ' + pos.lng).search();
        }, function(){
        	//There is an error getting the location for whatever reason
        	locationError(true, pos);
        });
      } else {
      	locationError(false, pos);
      }
	}

	function locationError(hasLocation, pos) {
		var alertMessage = hasLocation ? 'There was an error getting your geolocation, but search will still work.' : 'Your browser does not support geolocation, but search will still work.';
		alert(alertMessage);
		//No location to store
		sessionStorage.setItem('location.latitude', '');
        sessionStorage.setItem('location.longitude', '');
		algoliaHelper.search();
	}
});
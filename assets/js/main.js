$(document).ready(function () {
	//Application setup values
	var APPLICATION_ID = 'DQB9P11KG0';
	var SEARCH_ONLY_API_KEY = '15e2b97e443188bc7d372444cac5d59e';
	var RESTAURANTS_INDEX = 'restaurants_list';
	var PARAMS = {
	  hitsPerPage: 3,
	  maxValuesPerFacet: 7,
	  facets: ['food_type', 'stars_count_category'],
	  disjunctiveFacets: ['payment_options'],
	  index: RESTAURANTS_INDEX
	};

	var FACETS_STARS_CATEGORY = ['stars_count_category'];
	var FACETS_ORDER_OF_DISPLAY = ['food_type', 'stars_count_category', 'payment_options'];
	var FACETS_LABELS = {food_type: 'Cuisine/Food Type', stars_count_category: 'Rating', payment_options: 'Payment Options'};

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
	$leftColumn = $('#left-column');
	$rightColumn = $('#right-column');

	// Hogan templates binding
	var hitTemplate = Hogan.compile($('#hit-template').text());
	var statsTemplate = Hogan.compile($('#stats-template').text());
	var facetTemplate = Hogan.compile($('#facet-template').text());
	var ratingTemplate = Hogan.compile($('#rating-template').text());
	var noResultsTemplate = Hogan.compile($('#no-results-template').text());
	var paginationTemplate = Hogan.compile($('#pagination-template').text());

	// Initial search which gets the first search by location. 
	//There will be some latency when getting the first search, but that is because we need to get the user's location
	//Before we can query
	getLocation();

	//Search input. Whenever a key is pressed, the query variable grabs that value and the algoliaHelper queries 
	//for the information in query.
	$searchInput
	.on('input propertychange', function(e) {
	  var query = e.currentTarget.value;
	  var lat = sessionStorage.getItem('location.latitude');
	  var lng = sessionStorage.getItem('location.longitude');
	  if(lat && lng) {
	  	algoliaHelper.setQuery(query).setQueryParameter(lat + ' , ' + lng).search();
	  } else {
	  	algoliaHelper.setQuery(query).search();
	  }
	})
	.focus();

	//Once we get the search results, we want to display the results and stats of our search result.
	algoliaHelper.on('result', function(content, state) {
	  renderStats(content);
	  renderHits(content);
	  renderFacets(content, state);
	  handleNoResults(content);
	  renderPagination(content);
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
    	facetContent = {
	      facet: facetName,
	      title: FACETS_LABELS[facetName],
	      values: content.getFacetValues(facetName, {sortBy: ['count:desc']}),
	      disjunctive: $.inArray(facetName, PARAMS.disjunctiveFacets) !== -1
	    };
	    if($.inArray(facetName, FACETS_STARS_CATEGORY) !== -1) {
	    	//For star count
		    facetsHtml += ratingTemplate.render(facetContent);
	    } else {
	    	//Regular facets for payment or for food type
		   	facetsHtml += facetTemplate.render(facetContent);  
	    }
	  }
	  $facets.html(facetsHtml);
	}

	//Listens to click on fascet
	$(document).on('click', '.toggle-refine', function(e) {
	  e.preventDefault();
	  var facet = $(this).data('facet');
	  var value = $(this).data('value');
	  if(facet === 'stars_count_category') {
	  	algoliaHelper.clearRefinements('stars_count').addNumericRefinement('stars_count', '>=', value).search();
	  } else {
	  	algoliaHelper.toggleRefine(facet, value).search();
	  }
	});

	function renderPagination(content) {
		if(content.hits.length <= 2) {
			$('#show-more').css('display', 'none');
		} else {
			$pagination.html(paginationTemplate.render(pagination));
		}
	}

	//Handle the Show More / Less button clicks where we will show more or less hits depending on if 
	//Show Less or Show More is displayed
	$(document).on('click', '#show-more', function(e) {
	  	e.preventDefault();
		$(this).text(function(i, text) {
			if(text === "Show More") {
				algoliaHelper.searchOnce({hitsPerPage: 5000},
			  	function(error, content, state) {
			  		renderHits(content);
			  		renderFacets(content, state);
			  	});
			  	return "Show Less";
			} else {
				algoliaHelper.searchOnce({hitsPerPage: 3},
				function(error, content, state) {
				  	renderHits(content);
					renderFacets(content, state);
				});
				return "Show More";
			}
		});
	});

	//Function to call the $hits variable and use the hitTemplate to show the results on the page
	function renderHits(content) {
		var promise = new Promise(function(resolve, reject) {
			$hits.html(hitTemplate.render(content));
			resolve();
		});
		promise.then(function() {
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
		};
	}

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
	  //Set "no results" page to fill up the entire width & hide remaining CSS
	  $main.addClass('no-results');
	  var filters = [];
	  $hits.html(noResultsTemplate.render({query: content.query, filters: filters}));
	}

	//Function to get the user's location so tft queries are based on user's current location
	function getLocation() {
	  //The no-results class is removed when handleNoResults is called which is after every query
	  $main.addClass('no-results');
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
        	locationError();
        });
      } else {
      	locationError();
      }
	}

	function locationError() {
	    //The no-results class is removed when handleNoResults is called which is after every query
		sessionStorage.setItem('location.latitude', '');
        sessionStorage.setItem('location.longitude', '');
		algoliaHelper.search();
		$main.removeClass('remove-results');
	}
});
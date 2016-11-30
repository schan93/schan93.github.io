from algoliasearch import algoliasearch
import csv
import json
import os
import sys

def createIndex(appId, apiKey, indexName):
  #Create the algolia search client based on my app id and api key
  client = algoliasearch.Client(appId, apiKey)

  #Create an index based on the restaurants_list AND the csv file
  index = client.init_index(indexName)

  #Loop through the restuarants_list and find all the payment_options. If there is a payment_option with 
  restaurants_list = parseJson()

  #Add the restuarants_list into the index first
  index.add_objects(restaurants_list)

  #Open the CSV file and get each of the object Ids from the restaurants_info csv and generate JSON out of it
  #So we can updating the current existing restaurants_list json
  restaurants_info_json = parseCsv()

  index.partial_update_objects(restaurants_info_json)

  #Initialization of search settings
  #Note that the requirement is to search restaurants by name, cuisine, or location. 
  #Name and cusine can be denoted by name of the restaurant and food_type
  #However, location can mean a variety of things, such as address, city, state, country, neighborhood, area, and postal code
  #I think for the most intuitive search, for location I can put address, neighborhood, city.
  #I think state, country, and postal code are either too broad or not useful in terms of location, and almost always, 
  #the city name is contained in area. I think also it would help in terms of filtering results
  #So that we do not get a variety of unwanted results by limiting what we search on.

  #For custom rankings, I am to leverage the user's location to show restaurants closer to them higher in results, so 
  #I still need to do this. I think I can do this on the UI, utilizing the algoliaHelper.setQueryParameter('aroundLatLngViaIP', true).search() API.
  #For custom rankings, I can make it so that start count and then review count are the custom ranked
  #So that it goes by geolocation first, then it shows the highest start counts next, then it shows by the
  #ones with the most reviews next. This way the user always sees the highest rated, highest reviewed restaurants
  #Near their location
  settings = {
    'customRanking': ['desc(stars_count_category)', 'desc(reviews_count)'],
    'searchableAttributes': ['name', 'food_type', 'address', 'neighborhood', 'city'],
    'attributesForFaceting': ['food_type', 'stars_count_category', 'payment_options']
  }

  index.set_settings(settings)

def parseCsv():
  restaurantsCsv = 'resources/dataset/restaurants_info.csv'
  restaurantsInfoJson = 'resources/dataset/restaurants_info.json'
  #As the CSV file is being read, ensure that we write every row into a json file that can be used to update
  #The original restaurants_list json file so that we can create one big index out of it
  #Make sure that the stars_count or reviews_count are floats becaus they will be used in our custom ranking
  reader = csv.DictReader(open(restaurantsCsv), delimiter=';')
  with open(restaurantsInfoJson, 'w+') as textFile:
    listRows = []
    for row in reader:
      newRow = {}
      for key, value in row.items():
        if key == 'stars_count' or key == 'reviews_count':
          newRow[key] = float(value)
          if key == 'stars_count': 
            newRow = createCountFacet(newRow, float(value))
        else:
          newRow[key] = value
      listRows.append(newRow)
    textFile.write(json.dumps(listRows))

  #Load the restaurants info now
  restaurants_info_json = json.load(open(restaurantsInfoJson))

  # Remove the generated restaurant info json file because it is not needed anymore
  try:
    os.remove(restaurantsInfoJson)
  except OSError:
    pass

  return restaurants_info_json
#I think we want to keep a new key called star_count_category where we will create our facet based
#on this metric. This will keep a certain count of all star_counts that are greater than a particular number
#For example, if the star_count = 3.5, then we store it into a category called star_count_category = 3
def createCountFacet(newRow, value):
  starsCountCategory = 'stars_count_category'
  listCounts = []
  if(value >= 0):
    listCounts.append(0)
  if(value >= 1):
    listCounts.append(1)
  if(value >= 2):
    listCounts.append(2)
  if(value >= 3):
    listCounts.append(3)
  if(value >= 4):
    listCounts.append(4)
  if(value >= 5):
    listCounts.append(5)
  newRow[starsCountCategory] = listCounts
  return newRow

#Loop through restaurants_list json and set the Diners Club or Carte Blanche payment and set them to Discover cards.
#For JCB or Pay with Open Table or Cash Only, we don't include them into filterable facets
def parseJson():
  restaurants_list = json.load(open('resources/dataset/restaurants_list.json'))
  for obj in restaurants_list:
    newPayments = []
    for payment in obj['payment_options']:
      if payment == 'Diners Club' or payment == 'Carte Blanche':
        newPayments.append('Discover')
      elif payment == 'JCB' or payment == 'Pay with OpenTable' or payment == 'Cash Only':
        continue
      else:
        newPayments.append(payment)
    obj['payment_options'] = newPayments
  return restaurants_list

def main():
  if len(sys.argv) != 4:
    print("This script requires an Application ID, API Key, and an Index name to run properly.")
    sys.exit()
  else:
  	createIndex(sys.argv[1], sys.argv[2], sys.argv[3])

if __name__ == '__main__':
  main()



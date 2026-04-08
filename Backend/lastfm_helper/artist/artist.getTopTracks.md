# artist.getTopTracks

Get the top tracks by an artist on Last.fm, ordered by popularity.

## Endpoint Details

| Property           | Value                              |
| ------------------ | ---------------------------------- |
| **Method**         | GET                                |
| **Endpoint**       | `/2.0/?method=artist.gettoptracks` |
| **Authentication** | Not Required                       |

## Parameters

| Parameter     | Required          | Description                                                                                                                           |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `artist`      | Yes (unless mbid) | The artist name                                                                                                                       |
| `mbid`        | No                | The musicbrainz id for the artist                                                                                                     |
| `page`        | No                | The page number to fetch. Defaults to first page.                                                                                     |
| `limit`       | No                | The number of results to fetch per page. Defaults to 50.                                                                              |
| `autocorrect` | No                | Transform misspelled artist names into correct artist names (`0` or `1`). The corrected artist name will be returned in the response. |
| `api_key`     | Yes               | A Last.fm API key                                                                                                                     |

## Example URLs

- **JSON**: `/2.0/?method=artist.gettoptracks&artist=cher&api_key=YOUR_API_KEY&format=json`
- **XML**: `/2.0/?method=artist.gettoptracks&artist=cher&api_key=YOUR_API_KEY`

## Sample Response (XML)

```xml
<toptracks artist="Cher">
  <track rank="1">
    <name>Believe</name>
    <mbid/>
    <playcount>56325</playcount>
    <listeners>23217</listeners>
    <url>http://www.last.fm/music/Cher/_/Believe</url>
    <image size="small">...</image>
    <image size=" medium">...</image>
    <image size="large">...</image>
  </track>
  ...
</toptracks>
```

## Error Codes

| Code | Description                                                                            |
| ---- | -------------------------------------------------------------------------------------- |
| 2    | Invalid service - This service does not exist                                          |
| 3    | Invalid Method - No method with that name in this package                              |
| 4    | Authentication Failed - You do not have permissions to access the service              |
| 5    | Invalid format - This service doesn't exist in that format                             |
| 6    | Invalid parameters - Your request is missing a required parameter                      |
| 7    | Invalid resource specified                                                             |
| 8    | Operation failed - Something else went wrong                                           |
| 9    | Invalid session key - Please re-authenticate                                           |
| 10   | Invalid API key - You must be granted a valid key by last.fm                           |
| 11   | Service Offline - This service is temporarily offline. Try again later.                |
| 13   | Invalid method signature supplied                                                      |
| 16   | There was a temporary error processing your request. Please try again                  |
| 26   | Suspended API key - Access for your account has been suspended, please contact Last.fm |
| 29   | Rate limit exceeded - Your IP has made too many requests in a short period             |

## Related Methods

- `artist.getTopTags` (previous)
- `artist.removeTag` (next)

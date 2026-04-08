# track.getTopTags

Get the top tags for this track on Last.fm, ordered by tag count. Supply either track & artist name or mbid.

## Endpoint Details

| Property           | Value                           |
| ------------------ | ------------------------------- |
| **Method**         | GET                             |
| **Endpoint**       | `/2.0/?method=track.gettoptags` |
| **Authentication** | Not Required                    |

## Parameters

| Parameter     | Required          | Description                                                                                                                                                         |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `track`       | Yes (unless mbid) | The track name                                                                                                                                                      |
| `artist`      | Yes (unless mbid) | The artist name                                                                                                                                                     |
| `mbid`        | No                | The musicbrainz id for the track                                                                                                                                    |
| `autocorrect` | No                | Transform misspelled artist and track names into correct artist and track names (`0` or `1`). The corrected artist and track name will be returned in the response. |
| `api_key`     | Yes               | A Last.fm API key                                                                                                                                                   |

## Example URLs

- **JSON**: `/2.0/?method=track.gettoptags&artist=radiohead&track=paranoid+android&api_key=YOUR_API_KEY&format=json`
- **XML**: `/2.0/?method=track.gettoptags&artist=radiohead&track=paranoid+android&api_key=YOUR_API_KEY`

## Sample Response (XML)

```xml
<toptags artist="Cher" track="Believe">
  <tag>
    <name>pop</name>
    <count>97</count>
    <url>www.last.fm/tag/pop</url>
  </tag>
  <tag>
    <name>dance</name>
    <count>88</count>
    <url>www.last.fm/tag/dance</url>
  </tag>
  ...
</toptags>
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

- `track.getTags` (previous)
- `track.love` (next)

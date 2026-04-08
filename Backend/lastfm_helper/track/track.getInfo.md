# track.getInfo

Get the metadata for a track on Last.fm using the artist/track name or a musicbrainz id.

## Endpoint Details

| Property           | Value                        |
| ------------------ | ---------------------------- |
| **Method**         | GET                          |
| **Endpoint**       | `/2.0/?method=track.getInfo` |
| **Authentication** | Not Required                 |

## Parameters

| Parameter     | Required          | Description                                                                                                                                                         |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `track`       | Yes (unless mbid) | The track name                                                                                                                                                      |
| `artist`      | Yes (unless mbid) | The artist name                                                                                                                                                     |
| `mbid`        | No                | The musicbrainz id for the track                                                                                                                                    |
| `autocorrect` | No                | Transform misspelled artist and track names into correct artist and track names (`0` or `1`). The corrected artist and track name will be returned in the response. |
| `username`    | No                | The username for the context of the request. If supplied, the user's playcount for this track and whether they have loved the track is included in the response.    |
| `api_key`     | Yes               | A Last.fm API key                                                                                                                                                   |

## Example URLs

- **JSON**: `/2.0/?method=track.getInfo&api_key=YOUR_API_KEY&artist=cher&track=believe&format=json`
- **XML**: `/2.0/?method=track.getInfo&api_key=YOUR_API_KEY&artist=cher&track=believe`

## Sample Response (XML)

```xml
<track>
  <id>1019817</id>
  <name>Believe</name>
  <mbid/>
  <url>http://www.last.fm/music/Cher/_/Believe</url>
  <duration>240000</duration>
  <streamable fulltrack="1">1</streamable>
  <listeners>69572</listeners>
  <playcount>281445</playcount>
  <artist>
    <name>Cher</name>
    <mbid>bfcc6d75-a6a5-4bc6-8282-47aec8531818</mbid>
    <url>http://www.last.fm/music/Cher</url>
  </artist>
  <album position="1">
    <artist>Cher</artist>
    <title>Believe</title>
    <mbid>61bf0388-b8a9-48f4-81d1-7eb02706dfb0</mbid>
    <url>http://www.last.fm/music/Cher/Believe</url>
    <image size="small">http://userserve-ak.last.fm/serve/34/8674593.jpg</image>
    <image size="medium">http://userserve-ak.last.fm/serve/64/8674593.jpg</image>
    <image size="large">http://userserve-ak.last.fm/serve/126/8674593.jpg</image>
  </album>
  <toptags>
    <tag>
      <name>pop</name>
      <url>http://www.last.fm/tag/pop</url>
    </tag>
    ...
  </toptags>
  <wiki>
    <published>Sun, 27 Jul 2008 15:44:58 +0000</published>
    <summary>...</summary>
    <content>...</content>
  </wiki>
</track>
```

## Response Attributes

| Attribute    | Description                                                                            |
| ------------ | -------------------------------------------------------------------------------------- |
| `duration`   | In milliseconds                                                                        |
| `fulltrack`  | An attribute value of 1 indicates a full length preview is available for streaming     |
| `streamable` | A tag value of 1 indicates a 30 second preview of this song is available for streaming |

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

- `track.getCorrection` (previous)
- `track.getSimilar` (next)

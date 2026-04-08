# artist.getInfo

Get the metadata for an artist. Includes biography, truncated at 300 characters.

## Endpoint Details

| Property           | Value                         |
| ------------------ | ----------------------------- |
| **Method**         | GET                           |
| **Endpoint**       | `/2.0/?method=artist.getinfo` |
| **Authentication** | Not Required                  |

## Parameters

| Parameter     | Required          | Description                                                                                                                           |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `artist`      | Yes (unless mbid) | The artist name                                                                                                                       |
| `mbid`        | No                | The musicbrainz id for the artist                                                                                                     |
| `lang`        | No                | The language to return the biography in, expressed as an ISO 639 alpha-2 code                                                         |
| `autocorrect` | No                | Transform misspelled artist names into correct artist names (`0` or `1`). The corrected artist name will be returned in the response. |
| `username`    | No                | The username for the context of the request. If supplied, the user's playcount for this artist is included in the response.           |
| `api_key`     | Yes               | A Last.fm API key                                                                                                                     |

## Example URLs

- **JSON**: `/2.0/?method=artist.getinfo&artist=Cher&api_key=YOUR_API_KEY&format=json`
- **XML**: `/2.0/?method=artist.getinfo&artist=Cher&api_key=YOUR_API_KEY`

## Sample Response (XML)

```xml
<artist>
  <name>Cher</name>
  <mbid>bfcc6d75-a6a5-4bc6-8282-47aec8531818</mbid>
  <url>http://www.last.fm/music/Cher</url>
  <image size="small">http://userserve-ak.last.fm/serve/50/285717.jpg</image>
  <image size="medium">http://userserve-ak.last.fm/serve/85/285717.jpg</image>
  <image size="large">http://userserve-ak.last.fm/serve/160/285717.jpg</image>
  <streamable>1</streamable>
  <stats>
    <listeners>196440</listeners>
    <plays>1599101</plays>
  </stats>
  <similar>
    <artist>
      <name>Madonna</name>
      <url>http://www.last.fm/music/Madonna</url>
      <image size="small">http://userserve-ak.last.fm/serve/50/5112299.jpg</image>
      <image size="medium">http://userserve-ak.last.fm/serve/85/5112299.jpg></image>
      <image size="large">http://userserve-ak.last.fm/serve/160/5112299.jpg</image>
    </artist>
    ...
  </similar>
  <tags>
    <tag>
      <name>pop</name>
      <url>http://www.last.fm/tag/pop</url>
    </tag>
    ...
  </tags>
  <bio>
    <published>Thu, 13 Mar 2008 03:59:18 +0000</published>
    <summary>...</summary>
    <content>...</content>
  </bio>
</artist>
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

- `artist.getCorrection` (previous)
- `artist.getSimilar` (next)

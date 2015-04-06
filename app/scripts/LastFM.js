(function($){
    'use strict';

    var TrackInfoParser = (function() {

        return {
            parse: parse
        }

        /**
         * Clean the metadata.
         */
        function parse(track) {
            // Sometimes the artist name is in the track title.
            // e.g. Tokyo Rose - Zender Overdrive by Aphasia Records.
            var data = parseInfo(track.title);

            // If not, use the username.
            if (data.artist === '') {
                data.track = track.title;
                data.artist = 'soundcloudify';
            }

            // return clean metadata object.
            return data;
        };

        /**
         * Parse given string into artist and track, assume common order Art - Ttl
         * @return {artist, track}
         */
        function parseInfo(artistTitle) {
            var artist = '';
            var track = '';

            var separator = findSeparator(artistTitle);
            if (separator == null)
                return {
                    artist: '',
                    track: ''
                };

            artist = artistTitle.substr(0, separator.index);
            track = artistTitle.substr(separator.index + separator.length);

            return cleanArtistTrack(artist, track);
        }

        /**
         * Find first occurence of possible separator in given string
         * and return separator's position and size in chars or null.
         */
        function findSeparator(str) {
            // care - minus vs hyphen.
            var separators = [' - ', ' – ', '-', '–', ':'];

            // check the string for match.
            for (i in separators) {
                var sep = separators[i];
                var index = str.indexOf(sep);
                if (index > -1)
                    return {
                        index: index,
                        length: sep.length
                    };
            }

            return null;
        }

        /**
         * Clean non-informative garbage from title
         */
        function cleanArtistTrack(artist, track) {
            // Do some cleanup
            artist = artist.replace(/^\s+|\s+$/g, '');
            track = track.replace(/^\s+|\s+$/g, '');

            // Strip crap
            track = track.replace(/^\d+\.\s*/, ''); // 01.
            track = track.replace(/\s*\*+\s?\S+\s?\*+$/, ''); // **NEW**
            track = track.replace(/\s*\[[^\]]+\]$/, ''); // [whatever]
            track = track.replace(/\s*\([^\)]*version\)$/i, ''); // (whatever version)
            track = track.replace(/\s*\.(avi|wmv|mpg|mpeg|flv)$/i, ''); // video extensions
            track = track.replace(/\s*(of+icial\s*)?(music\s*)?video/i, ''); // (official)? (music)? video
            track = track.replace(/\s*\(\s*of+icial\s*\)/i, ''); // (official)
            track = track.replace(/\s*\(\s*[0-9]{4}\s*\)/i, ''); // (1999)
            track = track.replace(/\s+\(\s*(HD|HQ)\s*\)$/, ''); // HD (HQ)
            track = track.replace(/\s+(HD|HQ)\s*$/, ''); // HD (HQ)
            track = track.replace(/\s*video\s*clip/i, ''); // video clip
            track = track.replace(/\s+\(?live\)?$/i, ''); // live
            track = track.replace(/\(\s*\)/, ''); // Leftovers after e.g. (official video)
            track = track.replace(/^(|.*\s)"(.*)"(\s.*|)$/, '$2'); // Artist - The new "Track title" featuring someone
            track = track.replace(/^(|.*\s)'(.*)'(\s.*|)$/, '$2'); // 'Track title'
            track = track.replace(/^[\/\s,:;~-]+/, ''); // trim starting white chars and dash
            track = track.replace(/[\/\s,:;~-]+$/, ''); // trim trailing white chars and dash

            return {
                artist: artist,
                track: track
            };
        }
    }());

    window.LastFM = (function(){

        var apiUrl = 'https://ws.audioscrobbler.com/2.0/';
        var apiKey = '270d7aec2d7de22c88d90f36c66c9a1a';
        var apiSecret = 'c8a7d4cbfba61e6b777220878bfa8cc1';
        
        var sessionKey = localStorage.getItem('lastfm.sessionKey');
        var token = localStorage.getItem('lastfm.token');

        return {
            auth: auth,
            isAuth: isAuth,
            updateNowPlaying: updateNowPlaying,
            scrobble: scrobble
        };

        function auth() {

            //in the process of auth, continue to fetch the sessionKey
            if (token) {
                //open the last.fm auth page
                // var authUrl = 'https://www.last.fm/api/auth/?api_key=' + apiKey + '&token=' + token;
                // chrome.tabs.create({active: true, url: authUrl});
                var params = {
                    api_key: apiKey,
                    token: token,
                    method: 'auth.getSession'
                };

                //do a signed request
                _doRequest('GET', params, true, function(data) {
                    if (data.session && data.session.key) {
                        console.log('session key: ' + data.session.key);
                        sessionKey = data.session.key;
                        localStorage.setItem('lastfm.sessionKey', data.session.key);
                        token = '';
                        localStorage.setItem('lastfm.token', '');
                    } else {
                        if (data.error === 4) { //Invalid authentication token supplied
                            _requestToken();            
                        } else if (data.error = 14) { //This token has not been authorized
                            _openLastFmAuthentication(token);
                        }
                    }
                });

            } else {
                _requestToken();
            }
        }

        function isAuth() {
            return !!sessionKey;
        }

        function updateNowPlaying(track) {

            var trackInfo = TrackInfoParser.parse(track);

            var params = {
                method: 'track.updatenowplaying',
                track: trackInfo.track,
                artist: trackInfo.artist,
                api_key: apiKey,
                sk: sessionKey
            };

            function okCb() {
                console.log('update now playing successfully');
            }

            function errCb() {
                console.log('update now playing error');   
            }

            _doRequest('POST', params, true, okCb, errCb);
        }

        function scrobble(track) {

            var trackInfo = TrackInfoParser.parse(track);

            var params = {
                method: 'track.scrobble',
                'timestamp[0]': track.startTimestamp,
                'track[0]': trackInfo.track,
                'artist[0]': trackInfo.artist,
                api_key: apiKey,
                sk: sessionKey
            };

            function okCb() {
                console.log('scrobbling successfully');
            }

            function errCb() {
                console.log('scrobbling error');   
            }

            _doRequest('POST', params, true, okCb, errCb);
        }

        function signCall() {

        }

        function _createSignature(params) {

            var keys = [];
            var o = '';

            for (var x in params) {
                if (params.hasOwnProperty(x)) {
                    keys.push(x);
                }
            }

            // params has to be ordered alphabetically
            keys.sort();

            for (var i = 0; i < keys.length; i++) {
                if (keys[i] == 'format' || keys[i] == 'callback') {
                    continue;
                }

                o = o + keys[i] + params[keys[i]];
            }

            // append secret
            return md5(o + apiSecret);

        }

        function _requestToken() {

            //unsigned request
            _doRequest(
                'GET',
                {method: 'auth.getToken', api_key: apiKey},
                false,
                function(data) {
                    if (data.token) {
                        console.log('token: ' + data.token);
                        localStorage.setItem('lastfm.token', data.token);
                        token = data.token;
                        _openLastFmAuthentication(data.token);
                    } else {
                        console.log('LastFM.auth: no token key found');
                    }
                },
                function() {
                    console.log('LastFM._requestToken: error');
                }
            );
        }

        function _openLastFmAuthentication(token) {
            //open the last.fm auth page
            var authUrl = 'https://www.last.fm/api/auth/?api_key=' + apiKey + '&token=' + token;
            chrome.tabs.create({active: true, url: authUrl});
        }

        /**
         * Executes asynchronous request to L.FM and returns back in either callback
         *
         * API key will be added to params by default
         * and all parameters will be encoded for use in query string internally
         *
         * @param method [GET,POST]
         * @param params object of key => value url parameters
         * @param signed {Boolean} should the request be signed?
         * @param okCb
         * @param errCb
         */
        function _doRequest(method, params, signed, okCb, errCb) {
            params.api_key = config.apiKey;

            if (signed) {
                params.api_sig = _createSignature(params);
            }

            //always get JSON back
            params.format = 'json';

            var paramPairs = [];
            for (var key in params) {
                if (params.hasOwnProperty(key)) {
                    paramPairs.push(key + '=' + encodeURIComponent(params[key]));
                }
            }

            var url = apiUrl + '?' + paramPairs.join('&');

            if (method === 'GET') {
                $.get(url)
                    .done(okCb)
                    .fail(errCb);
            } else if (method === 'POST') {
                $.post(url)
                    .done(okCb)
                    .fail(errCb);
            } else {
                console.error('Unknown method: ' + method);
            }
        }
    }());

}(jQuery));

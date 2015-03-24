(function(){
    'use strict';

    angular.module('soundCloudify')
        .directive('explore', musicExploreDirective);

    function musicExploreDirective(Category, CorePlayer) {
        return {
            restrict: 'E',
            templateUrl: 'scripts/views/explore.html',
            scope: true,
            link: function($scope, element, attrs) {

                Category.getList().success(function(categories) {
                    $scope.categories = categories['music'] || [];
                });

                $scope.fallbackArtwork = chrome.extension.getURL('images/artwork-bar.jpg');

                $scope.$watch('chosenCategory', function(val) {
                    if (val) {
                        $scope.isLoading = true;
                        $scope.tracks = [];
                        Category.getTracks(val).success(function(tracks) {
                            $scope.isLoading = false;
                            $scope.tracks = tracks;
                        })
                    }
                });

                $scope.selectCategory = function(category) {
                    $scope.chosenCategory = category;
                };

                $scope.backToTopChart = function() {
                    $scope.chosenCategory = '';  
                }

                $scope.addTrack = function(track) {
                    CorePlayer.add(track, true);
                };

                $scope.sanitizeCategory = function(category) {
                    return unescape(category).replace(/\+/g, " ");
                };

                $scope.player = CorePlayer;
            }
        };
    }
}());

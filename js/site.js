function debounce(func, wait) {
  var timeout;

  return function () {
    var context = this;
    var args = arguments;
    clearTimeout(timeout);

    timeout = setTimeout(function () {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}

$(document).ready(function () {

  if (localStorage.getItem("theme") === "dark") {
    $("body").attr("theme", "dark");
    $("img, picture, video").attr("theme", "dark");
  }

  $(".navbar-burger").click(function () {
    $(".navbar-burger").toggleClass("is-active");
    $(".navbar-menu").toggleClass("is-active");
  });

  $('div.navbar-end > .navbar-item').each(function (el) {
    if (location.href.includes($(this).attr('href'))) {
      $('a.navbar-item.is-active').removeClass('is-active');
      $(this).addClass('is-active');
    }
  })
});

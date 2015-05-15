# Behave.js
## As simple as view programming can get

### What's that?
Behave.js is a framework aiming to solve one of the most tedious jobs of programming: UI creation and management.

### Why?
As I see it, web programmers who do client side should have a good knowledge of how HTML and CSS work.
When you have deep understanding of who layout engines work, you would like to harness their power in order
to produce better, more complex and more astonishing user experiences.

Unfortunately, today's most popular frameworks either drive the developer further apart from the surface (Angular's
don't-you-dare-messing-with-html-during-runtime) or replace it with their own markup languages (react's JSX). They,
of course, simplify overall development but force developers to either follow a very well defined pattern, or use
all kind of hacks in order to go around it.

### So how does Behave.js solve that?
Behave uses a hybrid method: On one hand, it uses completely standard markup. On the other, it supercharges it using
a (- let me be pretentious -) sophisticated controller system. It tops it all with an added selector system to simplify
view <-> view-model communication.

### How
Say, you have the following HTML code:

```
<div data-view-model="foo">
    <div data-component="user-info">
        <div class="title">Username: <div class="username"></div></div>
        <div class="title">Password: <div class="password"></div></div>
    </div>
</div>
```

Let's bring it to life:

```
Behave.view('foo')
      .listens('user-stuff')
      .expects({
        username: "string",
        password: "string"
      })
      .component('user-info', function($if) {
        $if.has('username').and('password').then(function() {
            this.find('.username').text($if.get('username'));
            this.find('.password').text($if.get('password'));
        });
      });
```

And that's it. You now have a live view with an independent component.
If you want to see it working, you can either write the following command in the console:

```
$v('foo').components('user-info').stream({username: "Roy", password: "Sommer"});
```

Or even add a button within the view's scope, and directly access the component:

```
<button onclick="$c('user-info').stream({username: 'Roy', password: 'Sommer'})">Click me</button>
```

Also, if you want your logic to be unaware of the views, you can broadcast data on a channel. Views can subscribe
to channels, and the logic can, in turn, broadcast on top of them, so you could be free to even change the flow of your
application without having to alternate your logic at all.

```
var SomeModule = new (function() {

    this.showUserData = function(user, pass) {
        $b('user-stuff').stream({
            username: user,
            password: pass
        });
    }

})();
```

Further information will be uploaded soon, as well as a boilerplate project, complete with gulp task for
faster-than-light development and deployment.

### Dependencies
Well, jQuery. That's it.

### Credits
Currently solely developed by me ([Roy Sommer](http://www.github.com/illberoy)). It's still in its very early stages,
so feedback of any kind is very welcome.
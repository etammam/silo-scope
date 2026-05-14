using Terminal.Gui.App;
using Terminal.Gui.Drawing;
using Terminal.Gui.ViewBase;
using Terminal.Gui.Views;

internal class Program
{
    private static void Main(string[] args)
    {
        using var app = Application.Create();
        app.Init();
        using var window = new Window()
        {
            Title = "Siloscope (Esc to quit)",
            BorderStyle = LineStyle.Rounded,
        };
        var label = new Label()
        {
            Text = "Hello, Terminal.Gui v2!",
            X = Pos.Center(),
            Y = Pos.Center(),
        };
        window.Add(label);

        app.Run(window);
    }
}
